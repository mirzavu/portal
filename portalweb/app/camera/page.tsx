'use client';

import { useState, useEffect, useRef } from 'react';
import { Video, AlertCircle } from 'lucide-react';
import Hls from 'hls.js';

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusRef = useRef<'loading' | 'playing' | 'error' | 'no-url' | 'ready'>('loading');
  const [streamStatus, setStreamStatus] = useState<'loading' | 'playing' | 'error' | 'no-url' | 'ready'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Helper to update status and ref together
  const updateStreamStatus = (status: 'loading' | 'playing' | 'error' | 'no-url' | 'ready') => {
    statusRef.current = status;
    setStreamStatus(status);
  };

  // Handle play button click
  const handlePlayClick = async () => {
    const video = videoRef.current;
    if (!video) return;
    
    try {
      await video.play();
      setIsPlaying(true);
      updateStreamStatus('playing');
    } catch (err: any) {
      console.error('[CAMERA DEBUG] Error playing video:', err);
      if (err.name === 'NotAllowedError') {
        setErrorMessage('Playback was blocked. Please interact with the page first.');
      } else {
        setErrorMessage(`Failed to play stream: ${err.message || 'Unknown error'}`);
      }
      updateStreamStatus('error');
    }
  };

  // Stream URL from environment variable (baked at build time)
  const streamUrl = process.env.NEXT_PUBLIC_CAMERA_STREAM_URL;

  useEffect(() => {
    // Initialize status ref
    statusRef.current = 'loading';
    updateStreamStatus('loading');
    
    console.log('[CAMERA DEBUG] ===== CAMERA PAGE LOADED =====');
    console.log('[CAMERA DEBUG] streamUrl:', streamUrl);
    console.log('[CAMERA DEBUG] streamUrl type:', typeof streamUrl);
    console.log('[CAMERA DEBUG] streamUrl truthy?', !!streamUrl);
    console.log('[CAMERA DEBUG] process.env:', process.env);
    console.log('[CAMERA DEBUG] process.env keys:', Object.keys(process.env));
    console.log('[CAMERA DEBUG] NEXT_PUBLIC_CAMERA_STREAM_URL:', process.env.NEXT_PUBLIC_CAMERA_STREAM_URL);
    console.log('[CAMERA DEBUG] NEXT_PUBLIC_POCKETBASE_URL:', process.env.NEXT_PUBLIC_POCKETBASE_URL);
    console.log('[CAMERA DEBUG] NEXT_PUBLIC_PIN_CODE:', process.env.NEXT_PUBLIC_PIN_CODE);
    console.log('[CAMERA DEBUG] typeof process.env:', typeof process.env);
    console.log('[CAMERA DEBUG] process.env.NEXT_PUBLIC_* count:', Object.keys(process.env).filter(k => k.startsWith('NEXT_PUBLIC_')).length);
    
    if (!streamUrl) {
      console.log('[CAMERA DEBUG] No stream URL - setting status to no-url');
      updateStreamStatus('no-url');
      return;
    }

    const video = videoRef.current;
    console.log('[CAMERA DEBUG] video element:', video);
    console.log('[CAMERA DEBUG] video element exists?', !!video);
    if (!video) {
      console.log('[CAMERA DEBUG] Video element not ready yet, returning');
      return;
    }

    // Setup loading timeout (15 seconds)
    const LOADING_TIMEOUT = 15000;
    timeoutRef.current = setTimeout(() => {
      if (statusRef.current === 'loading') {
        console.error('[CAMERA DEBUG] Loading timeout - stream did not connect within 15 seconds');
        updateStreamStatus('error');
        setErrorMessage('Stream connection timeout. The stream may be unavailable or taking too long to load.');
      }
    }, LOADING_TIMEOUT);

    // Check if browser supports native HLS (Safari, iOS)
    const canPlayNativeHLS = video.canPlayType('application/vnd.apple.mpegurl');
    console.log('[CAMERA DEBUG] Native HLS support:', canPlayNativeHLS);
    console.log('[CAMERA DEBUG] Native HLS support type:', typeof canPlayNativeHLS);
    
    // Try native HLS first if browser reports "probably" (definite support)
    // If browser reports "maybe" (uncertain) or "" (no support), fall through to HLS.js
    if (canPlayNativeHLS === 'probably') {
      console.log('[CAMERA DEBUG] Using native HLS playback (probably supported)');
      console.log('[CAMERA DEBUG] Setting video.src to:', streamUrl);
      
      let nativeHLSFailed = false;
      
      const handleLoadedMetadata = () => {
        console.log('[CAMERA DEBUG] Native HLS: loadedmetadata event fired');
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        updateStreamStatus('ready');
      };
      
      const handleCanPlay = () => {
        console.log('[CAMERA DEBUG] Native HLS: canplay event fired');
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        if (statusRef.current === 'loading') {
          updateStreamStatus('ready');
        }
      };
      
      const handleError = (e: Event) => {
        const videoError = video.error;
        console.error('[CAMERA DEBUG] Native HLS error:', videoError?.code, videoError?.message);
        console.error('[CAMERA DEBUG] Video error code:', videoError?.code);
        console.error('[CAMERA DEBUG] Video error message:', videoError?.message);
        
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        nativeHLSFailed = true;
        
        // Map error codes to user-friendly messages
        let errorMsg = 'Unknown error';
        if (videoError) {
          switch (videoError.code) {
            case 1: // MEDIA_ERR_ABORTED
              errorMsg = 'Stream loading was aborted';
              break;
            case 2: // MEDIA_ERR_NETWORK
              errorMsg = 'Network error while loading stream';
              break;
            case 3: // MEDIA_ERR_DECODE
              errorMsg = 'Error decoding stream (format may be unsupported)';
              break;
            case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
              errorMsg = 'Stream format not supported by browser';
              break;
            default:
              errorMsg = videoError.message || `Error code: ${videoError.code}`;
          }
        }
        
        updateStreamStatus('error');
        setErrorMessage(`Failed to load stream: ${errorMsg}`);
      };
      
      const handleStalled = () => {
        console.warn('[CAMERA DEBUG] Native HLS: stalled event - stream loading stalled');
      };
      
      const handleSuspend = () => {
        console.warn('[CAMERA DEBUG] Native HLS: suspend event - stream loading suspended');
      };
      
      const handleAbort = () => {
        console.warn('[CAMERA DEBUG] Native HLS: abort event - stream loading aborted');
        if (!nativeHLSFailed) {
          nativeHLSFailed = true;
          updateStreamStatus('error');
          setErrorMessage('Stream loading was aborted');
        }
      };
      
      const handleLoadStart = () => {
        console.log('[CAMERA DEBUG] Native HLS: loadstart event - started loading');
      };
      
      const handleProgress = () => {
        console.log('[CAMERA DEBUG] Native HLS: progress event - loading progress');
        const readyState = video.readyState;
        console.log('[CAMERA DEBUG] Video readyState:', readyState);
        // If we have enough data to play, consider it ready
        if (readyState >= 2 && statusRef.current === 'loading') {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          updateStreamStatus('ready');
        }
      };
      
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('error', handleError);
      video.addEventListener('stalled', handleStalled);
      video.addEventListener('suspend', handleSuspend);
      video.addEventListener('abort', handleAbort);
      video.addEventListener('loadstart', handleLoadStart);
      video.addEventListener('progress', handleProgress);
      
      video.src = streamUrl;
      
      // Don't autoplay - wait for user to click play button
      // Video will be ready when metadata loads
      
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('error', handleError);
        video.removeEventListener('stalled', handleStalled);
        video.removeEventListener('suspend', handleSuspend);
        video.removeEventListener('abort', handleAbort);
        video.removeEventListener('loadstart', handleLoadStart);
        video.removeEventListener('progress', handleProgress);
      };
    }

    // Use hls.js for browsers that don't support native HLS or if native HLS only reports "maybe"
    const hlsSupported = Hls.isSupported();
    console.log('[CAMERA DEBUG] HLS.js supported?', hlsSupported);
    
    if (hlsSupported) {
      // Clear timeout if we're using HLS.js (it will be set again after manifest loads)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      console.log('[CAMERA DEBUG] Creating HLS instance');
      console.log('[CAMERA DEBUG] Loading source:', streamUrl);
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        debug: true, // Enable debug logging
      });

      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      console.log('[CAMERA DEBUG] Attaching media to video element');
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_LOADING, () => {
        console.log('[CAMERA DEBUG] HLS: MANIFEST_LOADING event');
      });

      hls.on(Hls.Events.MANIFEST_LOADED, (event, data) => {
        console.log('[CAMERA DEBUG] HLS: MANIFEST_LOADED event', data);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.log('[CAMERA DEBUG] HLS: MANIFEST_PARSED event', data);
        console.log('[CAMERA DEBUG] Attempting to play video');
        
        // Clear loading timeout since manifest is loaded
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        // Listen for when enough data is buffered to play
        const handleCanPlay = () => {
          console.log('[CAMERA DEBUG] HLS: canplay event - stream is ready');
          if (statusRef.current === 'loading') {
            updateStreamStatus('ready');
          }
        };
        
        const handlePlaying = () => {
          console.log('[CAMERA DEBUG] HLS: playing event - video started playing');
          setIsPlaying(true);
          if (statusRef.current === 'ready' || statusRef.current === 'loading') {
            updateStreamStatus('playing');
          }
        };
        
        const handlePause = () => {
          console.log('[CAMERA DEBUG] HLS: pause event - video paused');
          setIsPlaying(false);
        };
        
        video.addEventListener('canplay', handleCanPlay, { once: true });
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('pause', handlePause);
        
        // Also listen for loadeddata as a fallback
        const handleLoadedData = () => {
          console.log('[CAMERA DEBUG] HLS: loadeddata event - enough data loaded');
          if (statusRef.current === 'loading') {
            updateStreamStatus('ready');
          }
        };
        video.addEventListener('loadeddata', handleLoadedData, { once: true });
        
        // Don't autoplay - wait for user to click play button
        console.log('[CAMERA DEBUG] Stream is loaded and ready - waiting for user to click play');
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        // Non-fatal errors (like bufferStalledError) are expected in live streaming
        // and are automatically handled by HLS.js - log them as warnings, not errors
        const isNonFatalBufferStall = !data.fatal && data.details === 'bufferStalledError';
        
        if (isNonFatalBufferStall) {
          // Silently ignore non-fatal buffer stalls - they're normal and auto-recovered
          console.log('[CAMERA DEBUG] HLS: Non-fatal buffer stall (auto-recovering)', {
            type: data.type,
            details: data.details,
            position: data.stalled?.start
          });
          return; // Don't process further - let HLS.js handle recovery
        }
        
        // Log other errors appropriately based on severity
        if (data.fatal) {
          console.error('[CAMERA DEBUG] HLS: FATAL ERROR event', data);
          console.error('[CAMERA DEBUG] Error type:', data.type);
          console.error('[CAMERA DEBUG] Error details:', data.details);
          console.error('[CAMERA DEBUG] Error URL:', data.url);
          console.error('[CAMERA DEBUG] Error response:', data.response);
          console.error('[CAMERA DEBUG] HLS fatal error:', data.type, data.details);
          
          // Clear timeout on fatal error
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          
          let errorMsg = '';
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              errorMsg = `Network error: ${data.details || 'Failed to load stream'}`;
              if (data.response?.code === 404) {
                errorMsg = 'Stream not found (404). The stream URL may be incorrect.';
              } else if (data.response?.code === 403) {
                errorMsg = 'Access forbidden (403). Check stream authentication.';
              } else if (data.response?.code) {
                errorMsg = `Network error (HTTP ${data.response.code}): ${data.details || 'Failed to load stream'}`;
              }
              updateStreamStatus('error');
              setErrorMessage(errorMsg);
              // Try to recover from network errors
              try {
                hls.startLoad();
              } catch (e) {
                console.error('[CAMERA DEBUG] Failed to restart HLS:', e);
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              errorMsg = `Media error: ${data.details || 'Failed to decode stream'}`;
              updateStreamStatus('error');
              setErrorMessage(errorMsg);
              // Try to recover from media errors
              try {
                hls.recoverMediaError();
              } catch (e) {
                console.error('[CAMERA DEBUG] Failed to recover from media error:', e);
              }
              break;
            default:
              errorMsg = `Stream error: ${data.details || 'Unknown error'}`;
              updateStreamStatus('error');
              setErrorMessage(errorMsg);
              hls.destroy();
              break;
          }
        } else {
          // Other non-fatal errors (not buffer stalls) - log as warnings but don't show to user
          console.warn('[CAMERA DEBUG] HLS: Non-fatal error (auto-recovering)', {
            type: data.type,
            details: data.details,
            fatal: data.fatal
          });
          // HLS.js will handle recovery automatically, no user action needed
        }
      });
    } else {
      console.error('[CAMERA DEBUG] HLS.js is not supported in this browser');
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      updateStreamStatus('error');
      setErrorMessage('HLS is not supported in this browser');
    }

    return () => {
      console.log('[CAMERA DEBUG] Cleanup function called');
      
      // Clear timeout on cleanup
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      if (hlsRef.current) {
        console.log('[CAMERA DEBUG] Destroying HLS instance');
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

          {/* Always render video element so ref is available, but show loading/play overlay when needed */}
          <div className="relative w-full bg-black rounded overflow-hidden">
            <video
              ref={videoRef}
              className={`w-full h-auto ${streamStatus === 'playing' || streamStatus === 'ready' ? '' : 'opacity-0 absolute'}`}
              controls
              playsInline
              muted={false}
              onPlay={() => {
                console.log('[CAMERA DEBUG] Video play event - user started playback');
                setIsPlaying(true);
                if (statusRef.current === 'loading' || statusRef.current === 'ready') {
                  updateStreamStatus('playing');
                }
              }}
              onPause={() => {
                setIsPlaying(false);
              }}
            />
            
            {streamStatus === 'loading' && (
              <div className="flex flex-col items-center justify-center py-16 relative z-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blood shadow-[0_0_20px_rgba(138,3,3,0.5)] mb-4"></div>
                <p className="text-gray-400 font-mono text-sm">Connecting to stream...</p>
              </div>
            )}
            
            {streamStatus === 'ready' && !isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                <button
                  onClick={handlePlayClick}
                  className="group relative px-8 py-4 bg-blood hover:bg-red-900 text-white font-mono text-sm uppercase transition-all border border-blood/50 shadow-[0_0_20px_rgba(138,3,3,0.5)] hover:shadow-[0_0_30px_rgba(138,3,3,0.7)] flex items-center gap-3"
                >
                  <Video className="w-6 h-6" />
                  <span>Play Stream</span>
                </button>
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

