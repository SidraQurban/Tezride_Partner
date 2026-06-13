import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Clipboard, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../utils/constants';
import { Logger } from '../utils/Logger';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    showDetails: boolean;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        showDetails: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, showDetails: false };
    }

    public async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
        await Logger.logError(error, true);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null, showDetails: false });
    };

    private handleCopyLog = () => {
        if (this.state.error) {
            const logText = `Error: ${this.state.error.message}\n\nStack: ${this.state.error.stack}`;
            Clipboard.setString(logText);
            Alert.alert('Copied', 'Error details copied to clipboard');
        }
    };

    private toggleDetails = () => {
        this.setState(prev => ({ showDetails: !prev.showDetails }));
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <SafeAreaView style={styles.container}>
                    <View style={styles.content}>
                        <View style={styles.iconContainer}>
                            <Text style={styles.icon}>⚠️</Text>
                        </View>
                        <Text style={styles.title}>Something went wrong</Text>
                        <Text style={styles.message}>
                            The application encountered an unexpected error. This log will help us fix the issue.
                        </Text>

                        <View style={styles.debugContainer}>
                            <View style={styles.debugHeader}>
                                <Text style={styles.debugTitle}>Crash Log</Text>
                                <TouchableOpacity onPress={this.handleCopyLog}>
                                    <Text style={styles.copyButton}>Copy Log</Text>
                                </TouchableOpacity>
                            </View>
                            
                            <ScrollView style={styles.logScroll}>
                                <Text style={styles.debugText}>
                                    {this.state.error?.toString() || 'Unknown Error'}
                                </Text>
                                {this.state.showDetails && (
                                    <Text style={[styles.debugText, { marginTop: 10, color: '#666' }]}>
                                        {this.state.error?.stack}
                                    </Text>
                                )}
                            </ScrollView>

                            <TouchableOpacity onPress={this.toggleDetails} style={styles.detailsToggle}>
                                <Text style={styles.detailsToggleText}>
                                    {this.state.showDetails ? 'Hide Stack Trace' : 'Show Stack Trace'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.buttonRow}>
                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: '#6c757d', marginRight: 10 }]}
                                onPress={this.handleReset}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.buttonText}>Try Again</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                                style={styles.button}
                                onPress={() => Alert.alert('Report Sent', 'Thank you for reporting this issue.')}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.buttonText}>Report Issue</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </SafeAreaView>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    iconContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#FFF5F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    icon: {
        fontSize: 35,
    },
    title: {
        fontSize: 22,
        fontFamily: FONTS.bold,
        color: COLORS.text,
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 14,
        fontFamily: FONTS.regular,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    debugContainer: {
        width: '100%',
        backgroundColor: '#f8f9fa',
        padding: 15,
        borderRadius: 12,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#dee2e6',
        maxHeight: 350,
    },
    debugHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 8,
    },
    debugTitle: {
        fontSize: 14,
        fontFamily: FONTS.bold,
        color: '#d32f2f',
    },
    copyButton: {
        fontSize: 12,
        color: COLORS.primary,
        fontFamily: FONTS.bold,
    },
    logScroll: {
        flexGrow: 0,
    },
    debugText: {
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        color: '#212529',
    },
    detailsToggle: {
        marginTop: 10,
        alignItems: 'center',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    detailsToggleText: {
        fontSize: 12,
        color: '#6c757d',
        fontFamily: FONTS.medium,
    },
    buttonRow: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'center',
    },
    button: {
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 10,
        minWidth: 120,
        alignItems: 'center',
    },
    buttonText: {
        color: COLORS.white,
        fontSize: 15,
        fontFamily: FONTS.bold,
    }
});

export default ErrorBoundary;
