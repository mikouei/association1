import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mobile-bug-crush-1.preview.emergentagent.com';
const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || 'https://mobile-bug-crush-1.preview.emergentagent.com';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const normalizedCode = code?.toUpperCase();
  
  // Récupérer les infos de l'association
  let associationName = 'Kotiz';
  try {
    const response = await fetch(`${API_URL}/api/public/associations/${normalizedCode}/info`);
    if (response.ok) {
      const data = await response.json();
      associationName = data.name || 'Kotiz';
    }
  } catch {
    // Fallback to default name
  }

  const manifest = {
    name: associationName,
    short_name: associationName.length > 12 ? associationName.substring(0, 12) + '...' : associationName,
    description: `Gestion des cotisations - ${associationName}`,
    start_url: `/join/${normalizedCode}`,
    display: 'standalone',
    background_color: '#1F4E79',
    theme_color: '#F5A623',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
