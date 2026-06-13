import * as signalR from '@microsoft/signalr';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.tezride.pk';
const HUB_URL = `${BASE_URL.replace(/\/$/, '')}/hubs/chat`;

class ChatHubService {
  private connection: signalR.HubConnection | null = null;
  private callbacks: { [key: string]: Function[] } = {};

  async start() {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      return;
    }

    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: async () => (await AsyncStorage.getItem('token')) || '',
        transport: signalR.HttpTransportType.WebSockets,
        skipNegotiation: true,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this._registerListeners();

    try {
      await this.connection.start();
      console.log('[ChatHub] Connected.');
    } catch (err) {
      console.error('[ChatHub] Connection failed:', err);
    }
  }

  private _registerListeners() {
    if (!this.connection) return;

    this.connection.on('JoinedChat', (payload: any) => {
      this._trigger('JoinedChat', payload);
    });

    this.connection.on('ReceiveMessage', (payload: any) => {
      this._trigger('ReceiveMessage', payload);
    });

    this.connection.on('UserTyping', (payload: any) => {
      this._trigger('UserTyping', payload);
    });
  }

  async joinRideChat(rideId: string) {
    await this.start();
    if (!this.isConnected()) {
      console.warn('[ChatHub] Cannot join chat: Not connected.');
      return;
    }
    return this.connection!.invoke('JoinRideChat', rideId);
  }

  async sendMessage(rideId: string, content: string) {
    await this.start();
    if (!this.isConnected()) {
      console.warn('[ChatHub] Cannot send message: Not connected.');
      return;
    }
    return this.connection!.invoke('SendMessage', rideId, content);
  }

  async typing(rideId: string) {
    await this.start();
    if (!this.isConnected()) return;
    return this.connection!.invoke('Typing', rideId);
  }

  isConnected() {
    return this.connection !== null && this.connection.state === signalR.HubConnectionState.Connected;
  }

  on(event: string, callback: Function) {
    if (!this.callbacks[event]) this.callbacks[event] = [];
    this.callbacks[event].push(callback);
  }

  off(event: string, callback: Function) {
    if (this.callbacks[event]) {
      this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
    }
  }

  private _trigger(event: string, payload: any) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(payload));
    }
  }

  async stop() {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
  }
}

export default new ChatHubService();
