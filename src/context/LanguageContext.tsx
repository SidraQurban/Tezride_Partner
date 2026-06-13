import React, { createContext, useContext, useState, useEffect } from 'react';
import i18n from '../locales/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORE_LANGUAGE_KEY = 'settings.lang';

interface LanguageContextType {
    language: string;
    setLanguage: (lang: string) => Promise<void>;
    isRTL: boolean;
    isReady: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState(i18n.language || 'en');
    const isRTL = language === 'ur';

    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const loadLanguage = async () => {
            const savedLang = await AsyncStorage.getItem(STORE_LANGUAGE_KEY);
            if (savedLang && savedLang !== i18n.language) {
                await i18n.changeLanguage(savedLang);
                setLanguageState(savedLang);
            }
            setIsReady(true);
        };
        loadLanguage();
    }, []);

    const setLanguage = async (lang: string) => {
        const shouldBeRTL = lang === 'ur';

        // Change i18next language - this triggers useTranslation re-renders
        await i18n.changeLanguage(lang);
        await AsyncStorage.setItem(STORE_LANGUAGE_KEY, lang);

        // Update local state to trigger context consumers
        setLanguageState(lang);

        // Runtime direction changes are handled by context-driven styles.
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, isRTL, isReady }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
