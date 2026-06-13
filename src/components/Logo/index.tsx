import React from 'react';
import { View, StyleSheet, Image, StyleProp, ImageStyle, Dimensions } from 'react-native';
import { COLORS } from '../../utils/constants';
import { useTheme } from '../../context/ThemeContext';

const { width: windowWidth } = Dimensions.get('window');

// Responsive helper mimicking Customer App's responsiveWidth
const responsiveWidth = (percent: number) => (windowWidth * percent) / 100;

interface LogoProps {
    size?: number;
    style?: StyleProp<ImageStyle>;
    inCircle?: boolean;
}

const Logo: React.FC<LogoProps> = ({ size, style, inCircle = false }) => {
    const { isFemale } = useTheme();

    const renderLogo = () => (
        <Image
            source={isFemale ? require('../../assets/female-tezride-logo-removebg.png') : require('../../assets/logo_customer.png')}
            style={[
                {
                    width: size || responsiveWidth(40),
                    height:undefined,
                    aspectRatio: 3,
                },
                style
            ]}
            resizeMode="contain"
        />
    );

    if (inCircle) {
        return (
            <View style={styles.circle}>
                {renderLogo()}
            </View>
        );
    }

    return renderLogo();
};

const styles = StyleSheet.create({
    circle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
});

export default Logo;
