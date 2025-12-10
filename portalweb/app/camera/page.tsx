'use client';

import { useState, useEffect, useRef } from 'react';
import { Video, AlertCircle, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Square, Eye, EyeOff, Moon, Sun, Loader2, User, Lightbulb, Move, Zap } from 'lucide-react';
import Hls from 'hls.js';

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusRef = useRef<'loading' | 'playing' | 'error' | 'no-url' | 'ready'>('loading');
  const [streamStatus, setStreamStatus] = useState<'loading' | 'playing' | 'error' | 'no-url' | 'ready'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Camera control states
  const [controlLoading, setControlLoading] = useState<string | null>(null);
  const [controlMessage, setControlMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [privacyMode, setPrivacyMode] = useState<boolean>(false);
  const [nightVision, setNightVision] = useState<boolean>(false);
  const [dayNight, setDayNight] = useState<boolean>(false);
  const [personDetection, setPersonDetection] = useState<boolean>(false);
  const [led, setLed] = useState<boolean>(false);
  const [autotrack, setAutotrack] = useState<boolean>(false);
  const [motion, setMotion] = useState<boolean>(false);
  
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

  // Camera control functions
  const sendCameraCommand = async (endpoint: string, commandName: string) => {
    if (controlLoading) return; // Prevent multiple simultaneous requests
    
    setControlLoading(commandName);
    setControlMessage(null);

    try {
      const response = await fetch(`/api/camera/control?endpoint=${encodeURIComponent(endpoint)}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setControlMessage({ type: 'success', text: `${commandName} command sent successfully` });
        
        // Update state for toggle commands
        if (endpoint === '/privacy/on') setPrivacyMode(true);
        if (endpoint === '/privacy/off') setPrivacyMode(false);
        if (endpoint === '/night/on') setNightVision(true);
        if (endpoint === '/night/off') setNightVision(false);
        if (endpoint === '/daynight/on') setDayNight(true);
        if (endpoint === '/daynight/off') setDayNight(false);
        if (endpoint === '/person/on') setPersonDetection(true);
        if (endpoint === '/person/off') setPersonDetection(false);
        if (endpoint === '/led/on') setLed(true);
        if (endpoint === '/led/off') setLed(false);
        if (endpoint === '/autotrack/on') setAutotrack(true);
        if (endpoint === '/autotrack/off') setAutotrack(false);
        if (endpoint === '/motion/on') setMotion(true);
        if (endpoint === '/motion/off') setMotion(false);
      } else {
        setControlMessage({ type: 'error', text: data.error || `Failed to send ${commandName} command` });
      }
    } catch (error: any) {
      console.error(`[CAMERA CONTROL] Error sending ${commandName}:`, error);
      setControlMessage({ 
        type: 'error', 
        text: `Network error: ${error.message || 'Cannot connect to camera device'}` 
      });
    } finally {
      setControlLoading(null);
      // Clear message after 3 seconds
      setTimeout(() => setControlMessage(null), 3000);
    }
  };

  const handlePTZCommand = (direction: 'up' | 'down' | 'left' | 'right' | 'stop') => {
    const endpoints = {
      up: '/ptz/up',
      down: '/ptz/down',
      left: '/ptz/left',
      right: '/ptz/right',
      stop: '/ptz/stop',
    };
    sendCameraCommand(endpoints[direction], `PTZ ${direction.charAt(0).toUpperCase() + direction.slice(1)}`);
  };

  const handlePrivacyToggle = () => {
    const endpoint = privacyMode ? '/privacy/off' : '/privacy/on';
    sendCameraCommand(endpoint, `Privacy ${privacyMode ? 'Off' : 'On'}`);
  };

  const handleNightVisionToggle = () => {
    const endpoint = nightVision ? '/night/off' : '/night/on';
    sendCameraCommand(endpoint, `Night Vision ${nightVision ? 'Off' : 'On'}`);
  };

  const handlePreset = (presetId: number) => {
    sendCameraCommand(`/preset/${presetId}`, `Preset ${presetId}`);
  };

  const handleDayNightToggle = () => {
    const endpoint = dayNight ? '/daynight/off' : '/daynight/on';
    sendCameraCommand(endpoint, `Day/Night ${dayNight ? 'Off' : 'On'}`);
  };

  const handlePersonToggle = () => {
    const endpoint = personDetection ? '/person/off' : '/person/on';
    sendCameraCommand(endpoint, `Person Detection ${personDetection ? 'Off' : 'On'}`);
  };

  const handleLedToggle = () => {
    const endpoint = led ? '/led/off' : '/led/on';
    sendCameraCommand(endpoint, `LED ${led ? 'Off' : 'On'}`);
  };

  const handleAutotrackToggle = () => {
    const endpoint = autotrack ? '/autotrack/off' : '/autotrack/on';
    sendCameraCommand(endpoint, `Auto Track ${autotrack ? 'Off' : 'On'}`);
  };

  const handleMotionToggle = () => {
    const endpoint = motion ? '/motion/off' : '/motion/on';
    sendCameraCommand(endpoint, `Motion ${motion ? 'Off' : 'On'}`);
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

      {/* Camera Controls Card */}
      <div className="mt-6 bg-charcoal/50 border border-gray-800 p-1 relative group">
        {/* Decorative corners */}
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blood"></div>
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blood"></div>
        
        <div className="bg-black/80 p-6 backdrop-blur-sm">
          <div className="mb-4">
            <h3 className="text-blood font-mono uppercase tracking-widest text-xs mb-1">
              Camera Controls
            </h3>
            <p className="text-gray-500 font-mono text-xs">
              PTZ movement, privacy mode, night vision, and preset positions
            </p>
          </div>

          {/* Control Message Feedback */}
          {controlMessage && (
            <div className={`mb-4 p-3 border rounded ${
              controlMessage.type === 'success' 
                ? 'bg-green-900/20 border-green-600/50 text-green-400' 
                : 'bg-red-900/20 border-red-600/50 text-red-400'
            }`}>
              <p className="font-mono text-xs">{controlMessage.text}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PTZ Controls */}
            <div className="space-y-4">
              <h4 className="text-gold font-mono uppercase text-xs tracking-wider mb-3">PTZ Movement</h4>
              <div className="flex flex-col items-center gap-2">
                {/* Up Button */}
                <button
                  onClick={() => handlePTZCommand('up')}
                  disabled={!!controlLoading}
                  className="w-16 h-16 bg-charcoal hover:bg-gray-800 border border-gray-700 hover:border-gold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center group"
                >
                  {controlLoading === 'PTZ Up' ? (
                    <Loader2 className="w-6 h-6 animate-spin text-gold" />
                  ) : (
                    <ArrowUp className="w-6 h-6 group-hover:text-gold transition-colors" />
                  )}
                </button>
                
                {/* Middle Row: Left, Stop, Right */}
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => handlePTZCommand('left')}
                    disabled={!!controlLoading}
                    className="w-16 h-16 bg-charcoal hover:bg-gray-800 border border-gray-700 hover:border-gold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center group"
                  >
                    {controlLoading === 'PTZ Left' ? (
                      <Loader2 className="w-6 h-6 animate-spin text-gold" />
                    ) : (
                      <ArrowLeft className="w-6 h-6 group-hover:text-gold transition-colors" />
                    )}
                  </button>
                  
                  <button
                    onClick={() => handlePTZCommand('stop')}
                    disabled={!!controlLoading}
                    className="w-16 h-16 bg-blood/20 hover:bg-blood/40 border border-blood/50 hover:border-blood text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center group"
                  >
                    {controlLoading === 'PTZ Stop' ? (
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                    ) : (
                      <Square className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    )}
                  </button>
                  
                  <button
                    onClick={() => handlePTZCommand('right')}
                    disabled={!!controlLoading}
                    className="w-16 h-16 bg-charcoal hover:bg-gray-800 border border-gray-700 hover:border-gold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center group"
                  >
                    {controlLoading === 'PTZ Right' ? (
                      <Loader2 className="w-6 h-6 animate-spin text-gold" />
                    ) : (
                      <ArrowRight className="w-6 h-6 group-hover:text-gold transition-colors" />
                    )}
                  </button>
                </div>
                
                {/* Down Button */}
                <button
                  onClick={() => handlePTZCommand('down')}
                  disabled={!!controlLoading}
                  className="w-16 h-16 bg-charcoal hover:bg-gray-800 border border-gray-700 hover:border-gold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center group"
                >
                  {controlLoading === 'PTZ Down' ? (
                    <Loader2 className="w-6 h-6 animate-spin text-gold" />
                  ) : (
                    <ArrowDown className="w-6 h-6 group-hover:text-gold transition-colors" />
                  )}
                </button>
              </div>
            </div>

            {/* Toggles and Presets */}
            <div className="space-y-4">
              {/* Privacy Mode Toggle */}
              <div>
                <h4 className="text-gold font-mono uppercase text-xs tracking-wider mb-3">Privacy Mode</h4>
                <button
                  onClick={handlePrivacyToggle}
                  disabled={!!controlLoading}
                  className={`w-full py-3 px-4 border transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group ${
                    privacyMode
                      ? 'bg-red-900/20 border-red-600/50 hover:border-red-600 text-red-400'
                      : 'bg-charcoal border-gray-700 hover:border-gold text-white'
                  }`}
                >
                  {controlLoading?.includes('Privacy') ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="font-mono text-xs uppercase">Sending...</span>
                    </>
                  ) : (
                    <>
                      {privacyMode ? (
                        <>
                          <EyeOff className="w-5 h-5" />
                          <span className="font-mono text-xs uppercase">Privacy On</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-5 h-5 group-hover:text-gold transition-colors" />
                          <span className="font-mono text-xs uppercase">Privacy Off</span>
                        </>
                      )}
                    </>
                  )}
                </button>
              </div>

              {/* Night Vision Toggle */}
              <div>
                <h4 className="text-gold font-mono uppercase text-xs tracking-wider mb-3">Night Vision</h4>
                <button
                  onClick={handleNightVisionToggle}
                  disabled={!!controlLoading}
                  className={`w-full py-3 px-4 border transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group ${
                    nightVision
                      ? 'bg-blue-900/20 border-blue-600/50 hover:border-blue-600 text-blue-400'
                      : 'bg-charcoal border-gray-700 hover:border-gold text-white'
                  }`}
                >
                  {controlLoading?.includes('Night Vision') ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="font-mono text-xs uppercase">Sending...</span>
                    </>
                  ) : (
                    <>
                      {nightVision ? (
                        <>
                          <Sun className="w-5 h-5" />
                          <span className="font-mono text-xs uppercase">Night Vision On</span>
                        </>
                      ) : (
                        <>
                          <Moon className="w-5 h-5 group-hover:text-gold transition-colors" />
                          <span className="font-mono text-xs uppercase">Night Vision Off</span>
                        </>
                      )}
                    </>
                  )}
                </button>
              </div>

              {/* Presets */}
              <div>
                <h4 className="text-gold font-mono uppercase text-xs tracking-wider mb-3">Preset Positions</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handlePreset(1)}
                    disabled={!!controlLoading}
                    className="py-3 px-4 bg-charcoal hover:bg-gray-800 border border-gray-700 hover:border-gold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                  >
                    {controlLoading === 'Preset 1' ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gold" />
                    ) : (
                      <>
                        <span className="font-mono text-xs">1</span>
                        <span className="font-mono text-xs uppercase">Preset</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handlePreset(2)}
                    disabled={!!controlLoading}
                    className="py-3 px-4 bg-charcoal hover:bg-gray-800 border border-gray-700 hover:border-gold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                  >
                    {controlLoading === 'Preset 2' ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gold" />
                    ) : (
                      <>
                        <span className="font-mono text-xs">2</span>
                        <span className="font-mono text-xs uppercase">Preset</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Camera Settings - Compact Grid */}
          <div className="mt-6 pt-6 border-t border-gray-800">
            <h4 className="text-gold font-mono uppercase text-xs tracking-wider mb-4">Camera Settings</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Day/Night Mode */}
              <button
                onClick={handleDayNightToggle}
                disabled={!!controlLoading}
                className={`py-2.5 px-3 border transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2 group ${
                  dayNight
                    ? 'bg-amber-900/20 border-amber-600/50 hover:border-amber-600 text-amber-400'
                    : 'bg-charcoal border-gray-700 hover:border-gold text-white'
                }`}
              >
                {controlLoading?.includes('Day/Night') ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Sun className={`w-4 h-4 ${!dayNight && 'group-hover:text-gold transition-colors'}`} />
                    <span className="font-mono text-[10px] uppercase leading-tight text-center">Day/Night</span>
                  </>
                )}
              </button>

              {/* Person Detection */}
              <button
                onClick={handlePersonToggle}
                disabled={!!controlLoading}
                className={`py-2.5 px-3 border transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2 group ${
                  personDetection
                    ? 'bg-green-900/20 border-green-600/50 hover:border-green-600 text-green-400'
                    : 'bg-charcoal border-gray-700 hover:border-gold text-white'
                }`}
              >
                {controlLoading?.includes('Person Detection') ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <User className={`w-4 h-4 ${!personDetection && 'group-hover:text-gold transition-colors'}`} />
                    <span className="font-mono text-[10px] uppercase leading-tight text-center">Person</span>
                  </>
                )}
              </button>

              {/* LED Control */}
              <button
                onClick={handleLedToggle}
                disabled={!!controlLoading}
                className={`py-2.5 px-3 border transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2 group ${
                  led
                    ? 'bg-yellow-900/20 border-yellow-600/50 hover:border-yellow-600 text-yellow-400'
                    : 'bg-charcoal border-gray-700 hover:border-gold text-white'
                }`}
              >
                {controlLoading?.includes('LED') ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Lightbulb className={`w-4 h-4 ${!led && 'group-hover:text-gold transition-colors'}`} />
                    <span className="font-mono text-[10px] uppercase leading-tight text-center">LED</span>
                  </>
                )}
              </button>

              {/* Auto Track */}
              <button
                onClick={handleAutotrackToggle}
                disabled={!!controlLoading}
                className={`py-2.5 px-3 border transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2 group ${
                  autotrack
                    ? 'bg-purple-900/20 border-purple-600/50 hover:border-purple-600 text-purple-400'
                    : 'bg-charcoal border-gray-700 hover:border-gold text-white'
                }`}
              >
                {controlLoading?.includes('Auto Track') ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Move className={`w-4 h-4 ${!autotrack && 'group-hover:text-gold transition-colors'}`} />
                    <span className="font-mono text-[10px] uppercase leading-tight text-center">Auto Track</span>
                  </>
                )}
              </button>

              {/* Motion Detection */}
              <button
                onClick={handleMotionToggle}
                disabled={!!controlLoading}
                className={`py-2.5 px-3 border transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2 group ${
                  motion
                    ? 'bg-orange-900/20 border-orange-600/50 hover:border-orange-600 text-orange-400'
                    : 'bg-charcoal border-gray-700 hover:border-gold text-white'
                }`}
              >
                {controlLoading?.includes('Motion') ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Zap className={`w-4 h-4 ${!motion && 'group-hover:text-gold transition-colors'}`} />
                    <span className="font-mono text-[10px] uppercase leading-tight text-center">Motion</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

