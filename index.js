import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import App from './src/App';

// Import background task definition to ensure it's registered early
import './src/services/BackgroundTaskService';

// Initialize global error handlers to capture crashes
import { initGlobalErrorHandlers } from './src/utils/Logger';
initGlobalErrorHandlers();

registerRootComponent(App);
