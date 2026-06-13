import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { COLORS, FONTS } from '../../utils/constants';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { getFontFamily, getFontSize } from '../../utils/layout';

interface HeaderProps {
    title?: string;
    showLogo?: boolean;
    showBack?: boolean;
    leftComponent?: React.ReactNode;
    rightComponent?: React.ReactNode;
}

import Logo from '../Logo/index';

const Header: React.FC<HeaderProps> = ({
    title,
    showLogo = false,
    showBack = false,
    leftComponent,
    rightComponent
}) => {
    const navigation = useNavigation<any>();
    const { isRTL } = useLanguage();
    const { theme } = useTheme();

    const backColor = theme.secondary;

    const renderBack = () => (
        <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
        >
            <ArrowLeft color={backColor} size={28} />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.centerSection}>
                <Logo style={styles.logoImage} />
            </View>

            {/* Always keep navigation/back on the left (LTR Layout Consistency) */}
            <View style={[styles.sideSection, { left: 20}]}>
                {showBack ? renderBack() : leftComponent}
            </View>

            <View style={[styles.sideSection, { right: 24 }]}>
                {rightComponent}
            </View>
        </View>
    );
};

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const responsiveWidth = (percent: number) => (windowWidth * percent) / 100;
const responsiveHeight = (percent: number) => (windowHeight * percent) / 100;

const styles = StyleSheet.create({
    container: {
        height: 64,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        paddingHorizontal: 20,
        zIndex: 10,
    },
    sideSection: {
        position: 'absolute',
        height: '100%',
        width: 60,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    centerSection: {
        paddingHorizontal: 0,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoImage: {
        width: responsiveWidth(100),
        height: responsiveHeight(9),
        resizeMode: "contain",
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default React.memo(Header);
