import { NextResponse } from 'next/server';
import { getAppUser } from '@/server/auth/dal';
import { getRealtimeProvider, isSSEProvider } from '@/server/realtime';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // 1. Authenticate connection
  const user = await getAppUser();
  const userId = user?.userId;

  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const provider = getRealtimeProvider();
  
  if (!isSSEProvider(provider)) {
    return new NextResponse('SSE Realtime not configured', { status: 501 });
  }

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection success message
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`));
      
      // Subscribe to user-specific channel
      cleanup = provider.addConnection(`user-${userId}`, controller);

    },
    cancel() {
      if (cleanup) cleanup();
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
