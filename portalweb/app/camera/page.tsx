'use client';

import { useState, useEffect, useRef } from 'react';
import { Video, AlertCircle, Radio } from 'lucide-react';
import Hls from 'hls.js';

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [streamStatus, setStreamStatus] = useState<'loading' | 'playing' | 'error' | 'no-url'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const streamUrl = process.env.NEXT_PUBLIC_CAMERA_STREAM_URL;

  useEffect(() => {
    if (!streamUrl) {
      setStreamStatus('no-url');
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    // Check if browser supports native HLS (Safari, iOS)
    const canPlayNativeHLS = video.canPlayType('application/vnd.apple.mpegurl');
    
    if (canPlayNativeHLS) {
      video.src = streamUrl;
      
      const handleLoadedMetadata = () => {
        setStreamStatus('playing');
      };
      
      const handleError = (e: Event) => {
        const videoError = video.error;
        console.error('[CAMERA] Native HLS error:', videoError?.code, videoError?.message);
        setStreamStatus('error');
        setErrorMessage(`Failed to load stream: ${videoError?.message || 'Unknown error'}`);
      };
      
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('error', handleError);
      
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('error', handleError);
      };
    }

    // Use hls.js for browsers that don't support native HLS
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        debug: false, // Disable verbose HLS.js logging in production
      });

      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().then(() => {
          setStreamStatus('playing');
        }).catch((err) => {
          console.error('[CAMERA] Error playing video:', err);
          setStreamStatus('error');
          setErrorMessage(`Failed to play stream: ${err.message}`);
        });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.error('[CAMERA] HLS fatal error:', data.type, data.details);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setStreamStatus('error');
              setErrorMessage(`Network error: ${data.details || 'Failed to load stream'}`);
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setStreamStatus('error');
              setErrorMessage(`Media error: ${data.details || 'Failed to decode stream'}`);
              hls.recoverMediaError();
              break;
            default:
              setStreamStatus('error');
              setErrorMessage(`Stream error: ${data.details || 'Unknown error'}`);
              hls.destroy();
              break;
          }
        }
      });
    } else {
      setStreamStatus('error');
      setErrorMessage('HLS is not supported in this browser');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl]);

  return (
    <div>
      {/* Header Section */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white font-serif drop-shadow-lg flex items-center gap-3">
            <span className="text-blood text-4xl">»</span> Live Camera Stream
          </h2>
          <p className="text-gray-500 font-mono text-sm mt-1 max-w-2xl">
            Real-time surveillance feed from secure camera network. 
            Stream is encrypted and monitored.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {streamStatus === 'playing' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-600/20 border border-red-600/50 rounded">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
              <span className="text-red-500 font-mono text-xs uppercase tracking-wider">LIVE</span>
            </div>
          )}
        </div>
      </div>

      {/* Video Player Card */}
      <div className="bg-charcoal/50 border border-gray-800 p-1 relative group">
        {/* Decorative corners */}
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blood"></div>
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blood"></div>
        
        <div className="bg-black/80 p-6 backdrop-blur-sm">
          {streamStatus === 'no-url' && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="w-16 h-16 text-gray-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-400 font-serif mb-2">
                Stream URL Not Configured
              </h3>
              <p className="text-gray-500 font-mono text-sm">
                Please set NEXT_PUBLIC_CAMERA_STREAM_URL in your environment variables.
              </p>
            </div>
          )}

          {streamStatus === 'error' && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="w-16 h-16 text-blood mb-4" />
              <h3 className="text-xl font-bold text-blood font-serif mb-2">
                Stream Unavailable
              </h3>
              <p className="text-gray-400 font-mono text-sm mb-4">
                {errorMessage || 'No live stream currently available'}
              </p>
              <button
                onClick={() => {
                  setStreamStatus('loading');
                  setErrorMessage('');
                  // Trigger re-initialization by updating a dependency
                  window.location.reload();
                }}
                className="px-6 py-2 bg-blood hover:bg-red-900 text-white font-mono text-xs uppercase transition-all border border-blood/50"
              >
                Retry Connection
              </button>
            </div>
          )}

          {/* Always render video element so ref is available, but show loading overlay when needed */}
          <div className="relative w-full bg-black rounded overflow-hidden">
            <video
              ref={videoRef}
              className={`w-full h-auto ${streamStatus === 'playing' ? '' : 'opacity-0 absolute'}`}
              controls
              playsInline
              muted={false}
              autoPlay
            />
            
            {streamStatus === 'loading' && (
              <div className="flex flex-col items-center justify-center py-16 relative z-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blood shadow-[0_0_20px_rgba(138,3,3,0.5)] mb-4"></div>
                <p className="text-gray-400 font-mono text-sm">Connecting to stream...</p>
              </div>
            )}
            
            {streamStatus === 'playing' && (
              <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 bg-black/70 backdrop-blur-sm rounded border border-red-600/50 z-10">
                <Radio className="w-3 h-3 text-red-500" />
                <span className="text-red-500 font-mono text-[10px] uppercase tracking-wider">
                  LIVE FEED
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stream Info Card */}
      {streamStatus === 'playing' && streamUrl && (
        <div className="mt-6 bg-black/50 border border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-blood font-mono uppercase tracking-widest text-xs mb-2">
                Stream Information
              </h3>
              <p className="text-gray-400 font-mono text-xs break-all">
                Source: {streamUrl}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-500 font-mono text-xs uppercase">ACTIVE</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

