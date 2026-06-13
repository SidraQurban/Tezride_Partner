import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SIZES } from '../utils/constants';
import Card from '../components/Card';
import { useTranslation } from 'react-i18next';
import { Bell, Zap, Gift, AlertCircle } from 'lucide-react-native';

const ZapIcon = Zap as any;
const GiftIcon = Gift as any;
const AlertCircleIcon = AlertCircle as any;

import Header from '../components/Header';
import { useLanguage } from '../context/LanguageContext';
import { getFontFamily, getTextAlign, getFontSize } from '../utils/layout';
import { useTheme } from '../context/ThemeContext';

const NotificationsScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { isRTL } = useLanguage();
    const { theme } = useTheme();
    
    const notifications = [
        { id: '1', title: t('notifications.bonusTitle'), body: t('notifications.bonusBody'), time: `2 ${t('common.minsAgo')}`, type: 'bonus' },
        { id: '2', title: t('notifications.paymentTitle'), body: t('notifications.paymentBody'), time: `5 ${t('common.minsAgo')}`, type: 'payment' },
        { id: '3', title: t('notifications.systemTitle'), body: t('notifications.systemBody'), time: '2 AM - 4 AM', type: 'system' },
    ];

    const getIcon = (type: string) => {
        switch (type) {
            case 'bonus': return <ZapIcon size={20} color={theme.primary} />;
            case 'payment': return <GiftIcon size={20} color={COLORS.success} />;
            default: return <AlertCircleIcon size={20} color={COLORS.secondary} />;
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Header title={t('notifications.title')} showBack={true} />
            <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: insets.bottom + 80 }
                ]}
                renderItem={({ item }) => (
                    <TouchableOpacity style={[styles.notificationItem, { flexDirection: 'row' }]}>
                        <View style={[
                            styles.iconContainer, 
                            { 
                                backgroundColor: COLORS.secondaryBackground,
                                marginRight: 15 
                            }
                        ]}>
                            {getIcon(item.type)}
                        </View>
                        <View style={styles.textContainer}>
                            <View style={[styles.row, { flexDirection: 'row' }]}>
                                <Text style={[styles.title, { textAlign: 'left', fontFamily: getFontFamily('semibold', isRTL), fontSize: getFontSize(15, isRTL) }]}>{item.title}</Text>
                                <Text style={[styles.time, { fontFamily: getFontFamily('regular', isRTL), fontSize: getFontSize(11, isRTL) }]}>{item.time}</Text>
                            </View>
                            <Text style={[styles.body, { textAlign: 'left', fontFamily: getFontFamily('regular', isRTL), fontSize: getFontSize(13, isRTL) }]}>{item.body}</Text>
                        </View>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    header: {
        padding: SIZES.padding,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    headerTitle: {
        ...FONTS.h2,
    },
    listContent: {
        padding: 10,
        // paddingBottom will be applied dynamically
    },
    notificationItem: {
        flexDirection: 'row',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.secondaryBackground,
    },
    iconContainer: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        flex: 1,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.text,
    },
    time: {
        fontSize: 11,
        color: COLORS.textSecondary,
    },
    body: {
        fontSize: 13,
        color: COLORS.textSecondary,
        lineHeight: 18,
    },
});

export default NotificationsScreen;
