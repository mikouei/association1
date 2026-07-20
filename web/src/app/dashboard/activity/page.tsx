'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { Card, CardContent, Button } from '@/components/ui';
import { ClockCounterClockwise, User, ArrowClockwise } from '@phosphor-icons/react';

interface ActivityLog {
  id: string;
  userId: string | null;
  userName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  'member.create': { label: 'Membre créé', color: 'bg-green-100 text-green-700' },
  'member.update': { label: 'Membre modifié', color: 'bg-blue-100 text-blue-700' },
  'member.deactivate': { label: 'Membre désactivé', color: 'bg-orange-100 text-orange-700' },
  'member.activate': { label: 'Membre réactivé', color: 'bg-green-100 text-green-700' },
  'member.reset_password': { label: 'MDP réinitialisé', color: 'bg-yellow-100 text-yellow-700' },
  'payment.create': { label: 'Paiement créé', color: 'bg-green-100 text-green-700' },
  'payment.update': { label: 'Paiement modifié', color: 'bg-blue-100 text-blue-700' },
  'payment.delete': { label: 'Paiement supprimé', color: 'bg-red-100 text-red-700' },
  'year.create': { label: 'Année créée', color: 'bg-green-100 text-green-700' },
  'year.update': { label: 'Année modifiée', color: 'bg-blue-100 text-blue-700' },
  'year.activate': { label: 'Année activée', color: 'bg-purple-100 text-purple-700' },
  'year.delete': { label: 'Année supprimée', color: 'bg-red-100 text-red-700' },
  'admin.create': { label: 'Admin créé', color: 'bg-green-100 text-green-700' },
  'admin.deactivate': { label: 'Admin désactivé', color: 'bg-orange-100 text-orange-700' },
  'admin.activate': { label: 'Admin réactivé', color: 'bg-green-100 text-green-700' },
  'admin.reset_password': { label: 'MDP admin réinitialisé', color: 'bg-yellow-100 text-yellow-700' },
  'exceptional.create': { label: 'Cotis. except. créée', color: 'bg-green-100 text-green-700' },
  'exceptional.update': { label: 'Cotis. except. modifiée', color: 'bg-blue-100 text-blue-700' },
  'exceptional.delete': { label: 'Cotis. except. supprimée', color: 'bg-red-100 text-red-700' },
  'exceptional_payment.create': { label: 'Paiement except. créé', color: 'bg-green-100 text-green-700' },
  'exceptional_payment.update': { label: 'Paiement except. modifié', color: 'bg-blue-100 text-blue-700' },
  'exceptional_payment.delete': { label: 'Paiement except. supprimé', color: 'bg-red-100 text-red-700' },
};

export default function ActivityLogPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const loadLogs = async (cursor?: string) => {
    if (cursor) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams({ limit: '30' });
      if (cursor) params.append('before', cursor);

      const response = await api.get(`/activity-log?${params}`);
      const data = response.data;

      if (cursor) {
        setLogs(prev => [...prev, ...data.logs]);
      } else {
        setLogs(data.logs);
      }
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch (error) {
      console.error('Error loading activity log:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionInfo = (action: string) => {
    return ACTION_LABELS[action] || { label: action, color: 'bg-gray-100 text-gray-700' };
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-[var(--color-text-muted)]">
              Accès réservé aux administrateurs
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClockCounterClockwise size={28} weight="duotone" className="text-[var(--color-primary)]" />
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Journal d&apos;activité</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadLogs()}
          disabled={loading}
        >
          <ArrowClockwise size={16} className={loading ? 'animate-spin' : ''} />
          Actualiser
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ClockCounterClockwise size={48} className="mx-auto text-[var(--color-text-muted)] mb-4" />
            <p className="text-[var(--color-text-muted)]">
              Aucune activité enregistrée pour le moment
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {logs.map((log) => {
              const actionInfo = getActionInfo(log.action);
              return (
                <Card key={log.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-[var(--color-background)] flex items-center justify-center flex-shrink-0">
                        <User size={20} className="text-[var(--color-text-muted)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-[var(--color-text)]">
                            {log.userName}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${actionInfo.color}`}>
                            {actionInfo.label}
                          </span>
                        </div>
                        {log.details && (
                          <p className="text-sm text-[var(--color-text-muted)] mt-1 break-words">
                            {log.details}
                          </p>
                        )}
                        <p className="text-xs text-[var(--color-text-muted)] mt-2">
                          {formatDate(log.createdAt)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {hasMore && (
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                onClick={() => nextCursor && loadLogs(nextCursor)}
                disabled={loadingMore}
              >
                {loadingMore ? 'Chargement...' : 'Charger plus'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
