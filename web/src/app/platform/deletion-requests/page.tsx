'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Button, toast } from '@/components/ui';
import { platformApi } from '@/services/api';

interface DeletionRequest {
  id: string;
  email: string | null;
  phone: string | null;
  associationCode: string;
  message: string | null;
  status: 'pending' | 'processed' | 'rejected';
  processedAt: string | null;
  processedBy: string | null;
  createdAt: string;
}

export default function DeletionRequestsPage() {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'processed' | 'rejected'>('all');

  const loadRequests = async () => {
    try {
      const response = await platformApi.get('/platform/deletion-requests');
      setRequests(response.data);
    } catch (error) {
      console.error('Erreur chargement demandes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleProcess = async (id: string, status: 'processed' | 'rejected') => {
    if (!confirm(`Êtes-vous sûr de vouloir marquer cette demande comme "${status === 'processed' ? 'traitée' : 'rejetée'}" ?`)) {
      return;
    }

    setProcessing(id);
    try {
      await platformApi.put(`/platform/deletion-requests/${id}`, { status });
      loadRequests();
    } catch (error) {
      console.error('Erreur traitement:', error);
      toast.error('Erreur lors du traitement de la demande');
    } finally {
      setProcessing(null);
    }
  };

  const filteredRequests = requests.filter(req => {
    if (filter === 'all') return true;
    return req.status === filter;
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">En attente</span>;
      case 'processed':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Traitée</span>;
      case 'rejected':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Rejetée</span>;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout requirePlatformAuth>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Demandes de suppression</h1>
            <p className="text-gray-500">
              Gérez les demandes de suppression de compte reçues via le formulaire web
            </p>
          </div>
          {pendingCount > 0 && (
            <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg font-medium">
              {pendingCount} demande{pendingCount > 1 ? 's' : ''} en attente
            </div>
          )}
        </div>

        {/* Filtres */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Toutes ({requests.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'pending' 
                ? 'bg-yellow-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            En attente ({requests.filter(r => r.status === 'pending').length})
          </button>
          <button
            onClick={() => setFilter('processed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'processed' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Traitées ({requests.filter(r => r.status === 'processed').length})
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'rejected' 
                ? 'bg-red-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Rejetées ({requests.filter(r => r.status === 'rejected').length})
          </button>
        </div>

        {/* Liste des demandes */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Chargement...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {filter === 'all' 
                  ? 'Aucune demande de suppression reçue'
                  : `Aucune demande ${filter === 'pending' ? 'en attente' : filter === 'processed' ? 'traitée' : 'rejetée'}`
                }
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredRequests.map((request) => (
                  <div key={request.id} className="p-6 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          {getStatusBadge(request.status)}
                          <span className="text-sm text-gray-500">
                            {formatDate(request.createdAt)}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Association:</span>
                            <span className="ml-2 text-gray-900">{request.associationCode}</span>
                          </div>
                          {request.email && (
                            <div>
                              <span className="font-medium text-gray-700">Email:</span>
                              <span className="ml-2 text-gray-900">{request.email}</span>
                            </div>
                          )}
                          {request.phone && (
                            <div>
                              <span className="font-medium text-gray-700">Téléphone:</span>
                              <span className="ml-2 text-gray-900">{request.phone}</span>
                            </div>
                          )}
                        </div>

                        {request.message && (
                          <div className="text-sm">
                            <span className="font-medium text-gray-700">Message:</span>
                            <p className="mt-1 text-gray-600 bg-gray-50 p-2 rounded">
                              {request.message}
                            </p>
                          </div>
                        )}

                        {request.processedAt && (
                          <div className="text-xs text-gray-500">
                            Traitée le {formatDate(request.processedAt)} par {request.processedBy}
                          </div>
                        )}
                      </div>

                      {request.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleProcess(request.id, 'processed')}
                            disabled={processing === request.id}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            {processing === request.id ? '...' : 'Traiter'}
                          </button>
                          <button
                            onClick={() => handleProcess(request.id, 'rejected')}
                            disabled={processing === request.id}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                          >
                            {processing === request.id ? '...' : 'Rejeter'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Instructions de traitement</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <p><strong>Pour traiter une demande :</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Identifiez le membre dans l&apos;association concernée via son email ou téléphone</li>
              <li>Utilisez l'interface d&apos;administration de l&apos;association pour anonymiser manuellement le compte</li>
              <li>Marquez la demande comme &quot;Traitée&quot; une fois terminé</li>
            </ol>
            <p className="mt-4"><strong>Délai légal :</strong> 30 jours maximum pour traiter chaque demande</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
