'use client';

import * as React from 'react';
import { Room } from '@/types';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft, QrCode } from 'lucide-react';
import Link from 'next/link';

interface PrintSignClientViewProps {
  room: Room;
  qrDataUrl: string;
  targetUrl: string;
}

export function PrintSignClientView({ room, qrDataUrl, targetUrl }: PrintSignClientViewProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 flex flex-col items-center justify-center print:bg-white print:p-0">
      {/* Top action bar - hidden on print */}
      <div className="w-full max-w-[210mm] flex items-center justify-between mb-4 print:hidden">
        <Link href={`/room/${room.id}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Room
          </Button>
        </Link>
        <Button variant="primary" size="sm" onClick={handlePrint} className="bg-corporate-navy">
          <Printer className="w-4 h-4 mr-2" />
          Print Sign (A4 / Tabloid)
        </Button>
      </div>

      {/* Printable Sheet (Standard A4 Dimensions: 210mm x 297mm) */}
      <div className="w-full max-w-[210mm] min-h-[297mm] bg-white text-corporate-charcoal shadow-xl border border-corporate-hairline p-12 flex flex-col justify-between print:shadow-none print:border-none print:m-0 print:p-10 print:w-full print:h-screen">
        {/* Header Section */}
        <div className="text-center border-b-2 border-corporate-navy pb-8">
          <span className="text-xs font-bold tracking-[0.25em] text-slate-500 uppercase">
            Meeting Room Booking
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-corporate-navy tracking-tight mt-2 uppercase">
            {room.name}
          </h1>
          <div className="flex items-center justify-center gap-6 mt-3 text-sm font-semibold text-slate-600">
            <span>{room.location}</span>
            <span>•</span>
            <span>Capacity: {room.capacity} Persons</span>
          </div>
        </div>

        {/* Center QR Code Section */}
        <div className="flex flex-col items-center justify-center my-8 text-center">
          <div className="p-6 bg-white border-2 border-corporate-navy rounded-sm shadow-sm inline-block">
            <img
              src={qrDataUrl}
              alt={`QR Code for ${room.name}`}
              className="w-72 h-72 sm:w-80 sm:h-80 object-contain"
            />
          </div>

          <div className="mt-8 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-corporate-navy tracking-tight">
              Scan to check availability &amp; book
            </h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Scan with your smartphone camera to view today&apos;s schedule in realtime and instantly
              reserve this room.
            </p>
          </div>
        </div>

        {/* Footer Section */}
        <div className="border-t border-corporate-hairline pt-6 text-center text-xs text-slate-500 space-y-1">
          <p className="font-mono text-corporate-charcoal font-medium">{targetUrl}</p>
          <p className="text-[10px] text-slate-400">
            Internal Corporate Network Only • No external cloud dependencies
          </p>
        </div>
      </div>
    </div>
  );
}
