import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

export interface ThemeColors {
    primary: string;
    primaryLight: string;
    secondary: string;
    accent: string;
    background: string;
    cardBackground: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    error: string;
    warning: string;
    overlay: string;
    gradient: string[];
}

export const DefaultTheme: ThemeColors = {
    primary: '#FF991C',
    primaryLight: '#FFF4E6',
    secondary: '#FF5C00',
    accent: '#FF991C',
    background: '#F8F9FA',
    cardBackground: '#FFFFFF',
    text: '#1A1A1A',
    textSecondary: '#666666',
    border: '#EEEEEE',
    success: '#27AE60',
    error: '#F0655A',
    warning: '#F2C94C',
    overlay: 'rgba(0,0,0,0.5)',
    gradient: ['#FF991C', '#FF5C00'],
};

export const FemaleTheme: ThemeColors = {
    primary: '#E91E63',
    primaryLight: '#FFF0F6',
    secondary: '#FF69B4',
    accent: '#FF69B4',
    background: '#FFF9FB',
    cardBackground: '#FFFFFF',
    text: '#1A1A1A',
    textSecondary: '#666666',
    border: '#FFE0F0',
    success: '#E91E63',
    error: '#F06292',
    warning: '#FFC53D',
    overlay: 'rgba(233, 30, 99, 0.1)',
    gradient: ['#FF69B4', '#E91E63'],
};

interface ThemeContextType {
    theme: ThemeColors;
    isFemale: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [isFemale, setIsFemale] = useState(false);

    useEffect(() => {
        const genderValue = user?.gender;
        const gender = typeof genderValue === 'string' ? genderValue.toLowerCase() : '';
        
        console.log('[ThemeContext] Auth User Gender:', gender);
        
        if (gender === 'female') {
            setIsFemale(true);
        } else {
            setIsFemale(false);
        }
    }, [user]); // Watch the whole user object for any profile updates

    const theme = isFemale ? FemaleTheme : DefaultTheme;

    return (
        <ThemeContext.Provider value={{ theme, isFemale }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
