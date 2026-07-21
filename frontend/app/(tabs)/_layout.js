import { Tabs } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { colors, typography } from '../../utils/theme';
import { House, Wallet, CalendarDots, Users, ShieldCheck, GearSix } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '../../components/ErrorBoundary';

export default function TabsLayout() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const insets = useSafeAreaInsets();
  
  // Calculer le padding et la hauteur selon la zone de sécurité
  const bottomPadding = Math.max(8, insets.bottom);
  const tabBarHeight = 56 + bottomPadding;

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
            tabBarIcon: ({ color, focused }) => (
              <House size={24} color={color} weight={focused ? 'fill' : 'regular'} />
            ),
          }}
        />
        <Tabs.Screen
          name="cotisations"
          options={{
            title: 'Cotisations',
            tabBarIcon: ({ color, focused }) => (
              <Wallet size={24} color={color} weight={focused ? 'fill' : 'regular'} />
            ),
          }}
        />
        <Tabs.Screen
          name="exceptionnelles"
          options={{
            title: 'Événements',
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
          name="parametres"
          options={{
            title: 'Paramètres',
            tabBarIcon: ({ color, focused }) => (
              <GearSix size={24} color={color} weight={focused ? 'fill' : 'regular'} />
            ),
          }}
        />
      </Tabs>
    </ErrorBoundary>
  );
}
