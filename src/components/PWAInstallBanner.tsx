
import { useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePWA } from '@/hooks/usePWA';

export const PWAInstallBanner = () => {
  const { isInstallable, installApp } = usePWA();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!isInstallable || isDismissed) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 p-4 border-2 shadow-lg md:left-auto md:right-4 md:max-w-sm" 
          style={{ backgroundColor: '#181a18', borderColor: '#c2ab75' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img 
            src="/lovable-uploads/f91216d7-29ee-4634-a0ed-312ec0dacc5b.png" 
            alt="Takeover Basketball" 
            className="w-8 h-8 rounded"
          />
          <div>
            <h3 className="font-semibold text-sm" style={{ color: 'white' }}>
              Install Takeover Basketball
            </h3>
            <p className="text-xs opacity-75" style={{ color: 'white' }}>
              Get quick access from your home screen
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            onClick={installApp}
            className="text-xs"
            style={{ backgroundColor: '#c2ab75', color: '#181a18' }}
          >
            <Download className="w-3 h-3 mr-1" />
            Install
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsDismissed(true)}
            className="p-1"
            style={{ color: 'white' }}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
