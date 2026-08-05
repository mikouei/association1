import { Tabs } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { colors, typography } from '../../utils/theme';
import { House, Wallet, CalendarDots, Users, ShieldCheck, GearSix, Bell, QrCode, Eye } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '../../components/ErrorBoundary';
import api from '../../utils/api';

export default function TabsLayout() {
  const { user, token } = useAuth();
  const role = user?.role || 'MEMBER';
  const isAdmin = role === 'ADMIN';
  const isScanner = role === 'SCANNER';
  const isAuditeur = role === 'AUDITEUR';
  const isStaff = isAdmin || isScanner || isAuditeur;
  const insets = useSafeAreaInsets();
  const [announcementsEnabled, setAnnouncementsEnabled] = useState(false);
  
  // Calculer le padding et la hauteur selon la zone de sécurité
  const bottomPadding = Math.max(8, insets.bottom);
  const tabBarHeight = 56 + bottomPadding;

  // Fonction pour récupérer les paramètres de l'association
  const fetchSettings = useCallback(() => {
    if (!isStaff || !token) {
      setAnnouncementsEnabled(false);
      return;
    }
    api.get('/auth/association-settings')
      .then(res => setAnnouncementsEnabled(res.data.announcementsEnabled || false))
      .catch(() => setAnnouncementsEnabled(false));
  }, [isStaff, token]);

  // Récupérer les paramètres au montage et quand l'app revient au premier plan
  useEffect(() => {
    // Chargement initial
    fetchSettings();

    // Rafraîchir quand l'app revient au premier plan
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchSettings();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fetchSettings]);

  return (
    <ErrorBoundary>
      <Tabs
        screenOptions={{
          // Couleurs Kotiz Design System
          tabBarActiveTintColor: colors.primary,          // Or actif (#F5A623)
          tabBarInactiveTintColor: colors.secondary,      // Bleu nuit inactif (#1F4E79)
          tabBarStyle: {
            backgroundColor: colors.backgroundWhite,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            paddingTop: 8,
            paddingBottom: bottomPadding,
            height: tabBarHeight,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
          },
          tabBarLabelStyle: {
            fontSize: typography.tabLabel.fontSize,
            fontWeight: '600',
            marginTop: 2,
          },
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.secondary,            // Bleu nuit en-tête
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTintColor: colors.textOnSecondary,        // Texte blanc
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: typography.h3.fontSize,
            fontFamily: typography.fontFamilyHeading,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Accueil',
            // SCANNER et AUDITEUR n'ont pas accès à l'accueil complet, ils sont redirigés
            href: (isScanner || isAuditeur) ? null : '/index',
            tabBarIcon: ({ color, focused }) => (
              <House size={24} color={color} weight={focused ? 'fill' : 'regular'} />
            ),
          }}
        />
        <Tabs.Screen
          name="cotisations"
          options={{
            title: 'Cotisations',
            // Accessible à MEMBER et ADMIN, pas SCANNER
            href: isScanner ? null : '/cotisations',
            tabBarIcon: ({ color, focused }) => (
              <Wallet size={24} color={color} weight={focused ? 'fill' : 'regular'} />
            ),
          }}
        />
        <Tabs.Screen
          name="exceptionnelles"
          options={{
            title: 'Événements',
            // Accessible à MEMBER et ADMIN, pas SCANNER ni AUDITEUR
            href: (isScanner || isAuditeur) ? null : '/exceptionnelles',
            tabBarIcon: ({ color, focused }) => (
              <CalendarDots size={24} color={color} weight={focused ? 'fill' : 'regular'} />
            ),
          }}
        />
        <Tabs.Screen
          name="membres"
          options={{
            title: 'Membres',
            href: isAdmin ? '/membres' : null,
            tabBarIcon: ({ color, focused }) => (
              <Users size={24} color={color} weight={focused ? 'fill' : 'regular'} />
            ),
          }}
        />
        <Tabs.Screen
          name="admin"
          options={{
            title: 'Admin',
            href: isAdmin ? '/admin' : null,
            tabBarIcon: ({ color, focused }) => (
              <ShieldCheck size={24} color={color} weight={focused ? 'fill' : 'regular'} />
            ),
          }}
        />
        <Tabs.Screen
          name="annonces"
          options={{
            title: 'Annonces',
            href: (isAdmin && announcementsEnabled) ? '/annonces' : null,
            tabBarIcon: ({ color, focused }) => (
              <Bell size={24} color={color} weight={focused ? 'fill' : 'regular'} />
            ),
          }}
        />
        <Tabs.Screen
          name="parametres"
          options={{
            title: 'Paramètres',
            // Tous les utilisateurs ont accès aux paramètres
            tabBarIcon: ({ color, focused }) => (
              <GearSix size={24} color={color} weight={focused ? 'fill' : 'regular'} />
            ),
          }}
        />
      </Tabs>
    </ErrorBoundary>
  );
}
