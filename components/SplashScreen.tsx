import React from 'react';
import { View, Text, ActivityIndicator, Image, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface SplashScreenProps {
  progress?: string;
  isLoading?: boolean;
  loadingMessage?: string;
}

export default function SplashScreen({ progress, isLoading = true, loadingMessage }: SplashScreenProps) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Gradient overlay for better text readability */}
      <LinearGradient
        colors={['rgba(205, 255, 248, 0.8)', 'rgba(148, 191, 255, 0.7)', 'rgba(30, 58, 138, 0.6)']}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        zIndex: 1,
      }}>
        {/* Logo */}
        <View style={{
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          borderRadius: 80,
          padding: 20,
          marginBottom: 30,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}>
          <Image
            source={require('../assets/logo-james.png')}
            style={{
              width: 120,
              height: 120,
              resizeMode: 'contain',
            }}
          />
        </View>

        {/* App Name */}
        <Text style={{
          fontSize: 32,
          fontWeight: 'bold',
          color: 'white',
          marginBottom: 8,
          textAlign: 'center',
        }}>
          James Avisa
        </Text>
        
        {/* Subtitle */}
        <Text style={{
          fontSize: 16,
          color: 'rgba(255, 255, 255, 0.9)',
          textAlign: 'center',
          marginBottom: 40,
        }}>
          Sistema de Controle de Acesso
        </Text>
        
        {/* Loading indicator */}
        {isLoading && (
          <View style={{
            alignItems: 'center',
            marginBottom: 40,
          }}>
            <ActivityIndicator size="large" color="white" style={{
              marginBottom: 16,
            }} />
            <Text style={{
              fontSize: 16,
              color: 'rgba(255, 255, 255, 0.8)',
              textAlign: 'center',
            }}>
              {loadingMessage || 'Carregando...'}
            </Text>
          </View>
        )}
      
        {/* Version */}
        <Text style={{
          fontSize: 14,
          color: 'rgba(255, 255, 255, 0.8)',
          textAlign: 'center',
        }}>
          v1.0.0
        </Text>
      </View>
    </View>
  );
}