import React, {
    createContext,
    useState,
    useContext,
    useEffect,
    useRef,
    useCallback,
    useMemo,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SignalRService, ConnectionState } from '../services/SignalRService';
import { Alert } from 'react-native';
import api from '../services/api';
import { ridesService } from '../services/rides';
import { navigate } from '../services/NavigationService';

interface CustomerContextType {
    isLoading: boolean;
    connectionState: ConnectionState;
    activeRide: any;
    interestedDrivers: any[];
    searchState: 'idle' | 'searching' | 'driver_found' | 'assigned';

    // Actions
    createRide: (pickup: any, dropoff: any, vehicleType: string) => Promise<void>;
    selectDriver: (rideId: string, driverId: string) => Promise<void>;
    cancelRide: (rideId: string) => Promise<void>;
    resetState: () => void;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export const CustomerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [connectionState, setConnectionState] = useState<ConnectionState>('Disconnected');
    const [activeRide, setActiveRide] = useState<any>(null);
    const [interestedDrivers, setInterestedDrivers] = useState<any[]>([]);
    const [searchState, setSearchState] = useState<'idle' | 'searching' | 'driver_found' | 'assigned'>('idle');

    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;

        const unsubState = SignalRService.onStateChange('CUSTOMER', (state) => {
            if (isMountedRef.current) setConnectionState(state);
        });

        const eventUnsubs = registerHubEvents();

        return () => {
            isMountedRef.current = false;
            unsubState();
            eventUnsubs.forEach(unsub => unsub());
        };
    }, []);

    const registerHubEvents = () => {
        const unsubs: Array<() => void> = [];

        // 1. driver_interested
        unsubs.push(SignalRService.on('CUSTOMER', 'driver_interested', (payload: any) => {
            console.log('[SignalR:Customer] driver_interested:', payload);
            if (!isMountedRef.current) return;

            setInterestedDrivers((prev: any[]) => {
                const exists = prev.find(d => d.driverId === payload.driverInfo?.driverId);
                if (exists) return prev;
                return [...prev, payload.driverInfo];
            });
            setSearchState('driver_found');
        }));

        // 2. ride_assigned
        unsubs.push(SignalRService.on('CUSTOMER', 'ride_assigned', (payload: any) => {
            console.log('[SignalR:Customer] ride_assigned:', payload);
            if (!isMountedRef.current) return;

            setActiveRide((prev: any) => ({ ...prev, ...payload, status: 'assigned' }));
            setSearchState('assigned');

            // Navigate to tracking screen
            try { navigate('RideMapScreen', { rideId: payload.rideId }); } catch { }
        }));

        // 3. no_drivers_found
        unsubs.push(SignalRService.on('CUSTOMER', 'no_drivers_found', (payload: any) => {
            console.log('[SignalR:Customer] no_drivers_found');
            if (!isMountedRef.current) return;
            setIsLoading(false);
            setSearchState('idle');
            Alert.alert('No Drivers', 'We couldn\'t find any drivers nearby. Please try again.');
        }));

        // 4. DriverSelected
        unsubs.push(SignalRService.on('CUSTOMER', 'DriverSelected', (payload: any) => {
            console.log('[SignalR:Customer] DriverSelected:', payload);
            if (payload.success) {
                // Wait for ride_assigned event for full details
            }
        }));

        // 5. SelectDriverFailed
        unsubs.push(SignalRService.on('CUSTOMER', 'SelectDriverFailed', (payload: any) => {
            console.warn('[SignalR:Customer] SelectDriverFailed:', payload.reason);
            Alert.alert('Selection Failed', payload.reason || 'Could not select this driver.');
        }));

        // 6. RideCancelled
        unsubs.push(SignalRService.on('CUSTOMER', 'RideCancelled', (payload: any) => {
            console.log('[SignalR:Customer] RideCancelled');
            if (!isMountedRef.current) return;
            resetState();
        }));

        return unsubs;
    };

    const createRide = useCallback(async (pickup: any, dropoff: any, vehicleType: string) => {
        try {
            setIsLoading(true);
            setSearchState('searching');
            setInterestedDrivers([]);

            // Connect to Customer Hub
            await SignalRService.connect('CUSTOMER');

            const response = await ridesService.requestRide({
                pickup,
                dropoff,
                vehicleType,
            });

            if (isMountedRef.current) {
                setActiveRide(response.data);
                console.log('[CustomerContext] Ride created:', response.data.id);
            }
        } catch (err) {
            console.error('[CustomerContext] createRide error:', err);
            if (isMountedRef.current) setSearchState('idle');
            throw err;
        } finally {
            if (isMountedRef.current) setIsLoading(false);
        }
    }, []);

    const selectDriver = useCallback(async (rideId: string, driverId: string) => {
        try {
            // Prefer SignalR hub invocation
            await SignalRService.invoke('CUSTOMER', 'SelectDriver', rideId, driverId);
        } catch (hubErr) {
            console.warn('[CustomerContext] SelectDriver hub failed, using REST fallback');
            try {
                await ridesService.selectDriver(rideId, driverId);
            } catch (err) {
                console.error('[CustomerContext] selectDriver REST fallback error:', err);
                throw err;
            }
        }
    }, []);

    const resetState = useCallback(() => {
        if (isMountedRef.current) {
            setActiveRide(null);
            setInterestedDrivers([]);
            setSearchState('idle');
            setIsLoading(false);
        }
    }, []);

    const cancelRide = useCallback(async (rideId: string) => {
        try {
            // Prefer SignalR hub invocation
            await SignalRService.invoke('CUSTOMER', 'CancelRide', rideId);
        } catch (hubErr) {
            console.warn('[CustomerContext] CancelRide hub failed, using REST fallback');
            try {
                await ridesService.cancelRide(rideId);
            } catch (err) {
                console.error('[CustomerContext] cancelRide REST fallback error:', err);
            }
        } finally {
            resetState();
        }
    }, [resetState]);

    const contextValue = useMemo(() => ({
        isLoading,
        connectionState,
        activeRide,
        interestedDrivers,
        searchState,
        createRide,
        selectDriver,
        cancelRide,
        resetState,
    }), [isLoading, connectionState, activeRide, interestedDrivers, searchState,
        createRide, selectDriver, cancelRide, resetState]);

    return (
        <CustomerContext.Provider value={contextValue}>
            {children}
        </CustomerContext.Provider>
    );
};

export const useCustomer = () => {
    const context = useContext(CustomerContext);
    if (!context) throw new Error('useCustomer must be used within a CustomerProvider');
    return context;
};
