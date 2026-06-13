import React, { createContext, useContext, useState, useCallback } from 'react';
import ErrorModal from '../components/ErrorModal';

interface UIContextType {
    showError: (title: string, message: string, buttonText?: string, onClose?: () => void) => void;
    hideError: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [errorState, setErrorState] = useState({
        visible: false,
        title: '',
        message: '',
        buttonText: 'OK',
        onClose: () => {},
    });

    const showError = useCallback((title: string, message: string, buttonText: string = 'OK', onClose: () => void = () => {}) => {
        setErrorState({
            visible: true,
            title,
            message,
            buttonText,
            onClose,
        });
    }, []);

    const hideError = useCallback(() => {
        const callback = errorState.onClose;
        setErrorState(prev => ({ ...prev, visible: false }));
        if (callback) callback();
    }, [errorState.onClose]);

    return (
        <UIContext.Provider value={{ showError, hideError }}>
            {children}
            <ErrorModal
                visible={errorState.visible}
                title={errorState.title}
                message={errorState.message}
                buttonText={errorState.buttonText}
                onClose={hideError}
            />
        </UIContext.Provider>
    );
};

export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
};
