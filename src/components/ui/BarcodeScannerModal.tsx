import React, { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import Quagga from '@ericblade/quagga2';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
}

export function BarcodeScannerModal({ isOpen, onClose, onScan }: BarcodeScannerModalProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen && scannerRef.current) {
      setErrorMsg('');
      
      // Initialize Quagga
      Quagga.init({
        inputStream: {
          type: "LiveStream",
          target: scannerRef.current,
          constraints: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "environment" // Use rear camera
          },
        },
        locator: {
          patchSize: "medium", // 'x-small', 'small', 'medium', 'large', 'x-large'
          halfSample: true
        },
        numOfWorkers: navigator.hardwareConcurrency || 4,
        decoder: {
          readers: [
            "ean_reader",       // EAN-13 (Standard retail products)
            "upc_reader",       // UPC-A (Standard US retail)
            "upc_e_reader",     // UPC-E (Small US retail)
            "ean_8_reader",     // EAN-8 (Small retail products)
          ],
          multiple: false
        },
        locate: true
      }, (err) => {
        if (err) {
          console.error("Quagga initialization failed", err);
          setErrorMsg("Failed to start camera. Please ensure permissions are granted and camera is available.");
          return;
        }
        Quagga.start();
      });

      let scans: Record<string, number> = {};
      let lastScanTime = Date.now();

      const onDetected = (result: any) => {
        if (result && result.codeResult && result.codeResult.code) {
          const code = result.codeResult.code;
          
          // Drop obvious garbage (most retail barcodes are 8, 12, or 13 digits)
          if (code.length < 8) return;

          const now = Date.now();
          // Reset consensus if it's been more than 1.5 seconds since the last frame scan
          if (now - lastScanTime > 1500) {
            scans = {};
          }
          lastScanTime = now;

          scans[code] = (scans[code] || 0) + 1;

          // Require 3 identical readings of the exact same barcode to eliminate false positives
          if (scans[code] >= 3) {
            Quagga.stop();
            onScan(code);
            onClose();
          }
        }
      };

      Quagga.onDetected(onDetected);

      return () => {
        Quagga.offDetected(onDetected);
        Quagga.stop();
      };
    }
  }, [isOpen, onScan, onClose]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Scan Barcode">
      <div className="flex flex-col items-center justify-center p-2 sm:p-4 min-h-[300px]">
        {errorMsg ? (
          <div className="text-destructive text-center p-4 bg-destructive/10 rounded-md">
            {errorMsg}
          </div>
        ) : (
          <>
            <div className="w-full max-w-sm aspect-[4/3] sm:aspect-square rounded-lg overflow-hidden shadow-sm bg-black relative">
              {isOpen && (
                <div 
                  ref={scannerRef} 
                  className="absolute inset-0 [&>video]:!w-full [&>video]:!h-full [&>video]:!object-cover [&>canvas]:!absolute [&>canvas]:!top-0 [&>canvas]:!left-0 [&>canvas]:!w-full [&>canvas]:!h-full" 
                />
              )}
            </div>
            <p className="mt-6 text-sm text-muted-foreground text-center px-4">
              Point your camera at a barcode.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
