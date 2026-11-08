import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const backendRes = await fetch('http://localhost:8080/api/v1/parcels/quote', {
    method: 'POST',
    headers: {
      'Authorization': request.headers.get('authorization') || '',
      'Content-Type': 'application/json',
    },
    body: await request.text(),
  });

  return new NextResponse(await backendRes.text(), {
    status: backendRes.status,
    headers: { 'Content-Type': backendRes.headers.get('content-type') || 'application/json' },
  });
}
