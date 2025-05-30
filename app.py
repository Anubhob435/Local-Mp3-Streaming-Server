from flask import Flask, render_template, Response, send_file, jsonify, request, redirect
from flask_socketio import SocketIO, emit, join_room
import logging
import os
import glob
from googleapiclient.discovery import build
from dotenv import load_dotenv
import requests
import json
import yt_dlp
import threading
import time
from urllib.parse import urlparse

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Add CORS headers to all responses
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Range')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,HEAD')
    return response

# Handle preflight OPTIONS requests
@app.route('/youtube/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    response = jsonify({'status': 'ok'})
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Range')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,HEAD')
    return response

# YouTube API setup
YOUTUBE_API_KEY = os.getenv('YOUTUBE_API_KEY')
youtube = None

if YOUTUBE_API_KEY and YOUTUBE_API_KEY != 'your_youtube_api_key_here':
    try:
        youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)
    except Exception as e:
        logging.error(f"Failed to initialize YouTube API: {e}")

# YouTube-DL configuration
ytdl_opts = {
    'format': 'bestaudio/best',
    'noplaylist': True,
    'extractaudio': True,
    'audioformat': 'mp3',
    'outtmpl': '%(extractor)s-%(id)s-%(title)s.%(ext)s',
    'restrictfilenames': True,
    'no_warnings': True,
    'ignoreerrors': False,
    'logtostderr': False,
    'quiet': True,
    'no_color': True,
    'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

# Cache for YouTube audio URLs (expires after 1 hour)
youtube_cache = {}
cache_timeout = 3600  # 1 hour

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/mp3-list')
def mp3_list():
    """Get list of local MP3 files"""
    mp3_files = glob.glob('*.mp3')
    return jsonify(mp3_files)

@app.route('/stream')
@app.route('/stream/<filename>')
def stream(filename=None):
    if not filename:
        filename = 'Armadham.mp3'  # Default file
    
    def generate():
        try:
            with open(filename, 'rb') as f:
                data = f.read(1024)
                while data:
                    yield data
                    data = f.read(1024)
        except Exception as e:
            logging.error(f"Error reading file: {e}")
            yield b''
    return Response(generate(), mimetype='audio/mpeg')

@app.route('/youtube/search')
def youtube_search():
    """Search YouTube for videos"""
    if not youtube:
        return jsonify({'error': 'YouTube API not configured'}), 400
    
    query = request.args.get('q', '')
    max_results = int(request.args.get('max_results', 10))
    
    try:
        search_response = youtube.search().list(
            q=query,
            part='id,snippet',
            maxResults=max_results,
            type='video',
            videoDefinition='any'
        ).execute()
        
        videos = []
        for search_result in search_response.get('items', []):
            videos.append({
                'id': search_result['id']['videoId'],
                'title': search_result['snippet']['title'],
                'channel': search_result['snippet']['channelTitle'],
                'description': search_result['snippet']['description'][:200] + '...',
                'thumbnail': search_result['snippet']['thumbnails']['medium']['url'],
                'published': search_result['snippet']['publishedAt']
            })
        
        return jsonify(videos)
    
    except Exception as e:
        logging.error(f"YouTube search error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/youtube/video/<video_id>')
def youtube_video_info(video_id):
    """Get detailed info about a YouTube video"""
    if not youtube:
        return jsonify({'error': 'YouTube API not configured'}), 400
    
    try:
        video_response = youtube.videos().list(
            part='snippet,statistics,contentDetails',
            id=video_id
        ).execute()
        
        if not video_response['items']:
            return jsonify({'error': 'Video not found'}), 404
        
        video = video_response['items'][0]
        
        return jsonify({
            'id': video['id'],
            'title': video['snippet']['title'],
            'channel': video['snippet']['channelTitle'],
            'description': video['snippet']['description'],
            'duration': video['contentDetails']['duration'],
            'view_count': video['statistics'].get('viewCount', 0),
            'like_count': video['statistics'].get('likeCount', 0),
            'thumbnail': video['snippet']['thumbnails']['high']['url'],
            'published': video['snippet']['publishedAt']
        })
    
    except Exception as e:
        logging.error(f"YouTube video info error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/youtube/audio/<video_id>')
def youtube_audio(video_id):
    """Get YouTube audio stream URL"""
    try:
        logging.info(f"Extracting audio for video ID: {video_id}")
        
        # Check cache first
        cache_key = f"audio_{video_id}"
        current_time = time.time()
        
        if cache_key in youtube_cache:
            cached_data = youtube_cache[cache_key]
            if current_time - cached_data['timestamp'] < cache_timeout:
                logging.info(f"Using cached audio URL for {video_id}")
                return jsonify({
                    'success': True,
                    'audio_url': cached_data['url'],
                    'title': cached_data.get('title', 'Unknown'),
                    'duration': cached_data.get('duration', 0),
                    'cached': True
                })
        
        # Extract audio URL using yt-dlp
        video_url = f"https://www.youtube.com/watch?v={video_id}"
        logging.info(f"Extracting from URL: {video_url}")
        
        # Enhanced yt-dlp options for better compatibility
        ytdl_opts_enhanced = {
            'format': 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio/best[height<=480]',
            'noplaylist': True,
            'extractaudio': True,
            'audioformat': 'mp3',
            'quiet': True,
            'no_warnings': True,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'referer': 'https://www.youtube.com/',
            'headers': {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-us,en;q=0.5',
                'Sec-Fetch-Mode': 'navigate',
            }
        }
        
        with yt_dlp.YoutubeDL(ytdl_opts_enhanced) as ydl:
            info = ydl.extract_info(video_url, download=False)
            
            audio_url = None
            
            # Try to find the best audio format
            if 'formats' in info and info['formats']:
                # Look for audio-only formats first
                for fmt in info['formats']:
                    if (fmt.get('acodec', 'none') != 'none' and 
                        fmt.get('vcodec', 'none') == 'none' and
                        fmt.get('url')):
                        audio_url = fmt['url']
                        logging.info(f"Found audio-only format: {fmt.get('format_id')}")
                        break
                
                # If no audio-only format, look for any format with audio
                if not audio_url:
                    for fmt in info['formats']:
                        if (fmt.get('acodec', 'none') != 'none' and 
                            fmt.get('url')):
                            audio_url = fmt['url']
                            logging.info(f"Found format with audio: {fmt.get('format_id')}")
                            break
            
            # Fallback to direct URL if available
            if not audio_url and 'url' in info:
                audio_url = info['url']
                logging.info("Using direct URL from info")
            
            if not audio_url:
                logging.error(f"Could not extract audio URL for {video_id}")
                return jsonify({'success': False, 'error': 'Could not extract audio URL'}), 500
            
            logging.info(f"Successfully extracted audio URL for {video_id}")
            
            # Cache the result with additional metadata
            youtube_cache[cache_key] = {
                'url': audio_url,
                'timestamp': current_time,
                'title': info.get('title', 'Unknown'),
                'duration': info.get('duration', 0)
            }
            
            # Clean old cache entries
            cleanup_cache()
            
            # Return the audio URL as JSON for client-side handling
            response = jsonify({
                'success': True,
                'audio_url': audio_url,
                'title': info.get('title', 'Unknown'),
                'duration': info.get('duration', 0),
                'cached': False
            })
            
            # Add CORS headers
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
            
            return response
            
    except yt_dlp.DownloadError as e:
        logging.error(f"yt-dlp download error for {video_id}: {e}")
        error_response = jsonify({'success': False, 'error': f'Video unavailable or restricted: {str(e)}'})
        error_response.headers['Access-Control-Allow-Origin'] = '*'
        return error_response, 403
    except Exception as e:
        logging.error(f"YouTube audio extraction error for {video_id}: {e}")
        error_response = jsonify({'success': False, 'error': f'Audio extraction failed: {str(e)}'})
        error_response.headers['Access-Control-Allow-Origin'] = '*'
        return error_response, 500

@app.route('/youtube/stream/<video_id>')
def youtube_stream(video_id):
    """Stream YouTube audio directly (proxy method)"""
    try:
        logging.info(f"Streaming audio for video ID: {video_id}")
        
        # Get the audio URL first
        cache_key = f"audio_{video_id}"
        
        if cache_key not in youtube_cache:
            # Extract if not cached
            video_url = f"https://www.youtube.com/watch?v={video_id}"
            logging.info(f"Extracting audio URL for streaming: {video_url}")
            
            ytdl_opts_stream = {
                'format': 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio/best[height<=480]',
                'quiet': True,
                'no_warnings': True,
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'referer': 'https://www.youtube.com/'
            }
            
            with yt_dlp.YoutubeDL(ytdl_opts_stream) as ydl:
                info = ydl.extract_info(video_url, download=False)
                
                audio_url = None
                
                # Try to find the best audio format
                if 'formats' in info and info['formats']:
                    # Look for audio-only formats first
                    for fmt in info['formats']:
                        if (fmt.get('acodec', 'none') != 'none' and 
                            fmt.get('vcodec', 'none') == 'none' and
                            fmt.get('url')):
                            audio_url = fmt['url']
                            logging.info(f"Found audio-only format for streaming: {fmt.get('format_id')}")
                            break
                    
                    # If no audio-only format, look for any format with audio
                    if not audio_url:
                        for fmt in info['formats']:
                            if (fmt.get('acodec', 'none') != 'none' and 
                                fmt.get('url')):
                                audio_url = fmt['url']
                                logging.info(f"Found format with audio for streaming: {fmt.get('format_id')}")
                                break
                
                if not audio_url and 'url' in info:
                    audio_url = info['url']
                    logging.info("Using direct URL from info for streaming")
                
                if not audio_url:
                    logging.error(f"Could not extract audio URL for streaming: {video_id}")
                    return jsonify({'error': 'Could not extract audio'}), 500
                
                # Cache it
                youtube_cache[cache_key] = {
                    'url': audio_url,
                    'timestamp': time.time()
                }
        
        audio_url = youtube_cache[cache_key]['url']
        logging.info(f"Proxying audio stream from: {audio_url[:100]}...")
        
        # Proxy the audio stream with better headers
        def generate():
            try:
                # Prepare headers for the request to YouTube
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'audio/*,*/*;q=0.9',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'identity',
                    'Referer': 'https://www.youtube.com/',
                    'Origin': 'https://www.youtube.com'
                }
                
                # Pass through range request if present
                if 'Range' in request.headers:
                    headers['Range'] = request.headers['Range']
                
                # Make request to YouTube
                response = requests.get(audio_url, headers=headers, stream=True, timeout=30)
                response.raise_for_status()
                
                logging.info(f"Successfully connected to audio stream, content-type: {response.headers.get('content-type')}")
                
                # Stream the content
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        yield chunk
                        
            except requests.exceptions.RequestException as e:
                logging.error(f"Request error while streaming: {e}")
                yield b''
            except Exception as e:
                logging.error(f"General streaming error: {e}")
                yield b''
        
        # Determine content type
        content_type = 'audio/mpeg'
        try:
            # Quick HEAD request to get content type
            head_response = requests.head(audio_url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }, timeout=5)
            if head_response.headers.get('content-type'):
                content_type = head_response.headers['content-type']
        except:
            pass  # Use default if HEAD request fails
        
        response_headers = {
            'Accept-Ranges': 'bytes',
            'Content-Type': content_type,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range'
        }
        
        return Response(generate(), 
                       mimetype=content_type,
                       headers=response_headers)
        
    except yt_dlp.DownloadError as e:
        logging.error(f"yt-dlp download error for streaming {video_id}: {e}")
        return jsonify({'error': f'Video unavailable or restricted: {str(e)}'}), 403
    except Exception as e:
        logging.error(f"YouTube streaming error for {video_id}: {e}")
        return jsonify({'error': f'Streaming failed: {str(e)}'}), 500

def cleanup_cache():
    """Remove expired cache entries"""
    current_time = time.time()
    expired_keys = []
    
    for key, data in youtube_cache.items():
        if current_time - data['timestamp'] > cache_timeout:
            expired_keys.append(key)
    
    for key in expired_keys:
        del youtube_cache[key]

@app.route('/playlists')
def get_playlists():
    """Get user's playlists (mock data for now)"""
    # This would require OAuth for real user playlists
    mock_playlists = [
        {'id': 'liked', 'name': 'Liked Songs', 'count': 0},
        {'id': 'recent', 'name': 'Recently Played', 'count': 0},
        {'id': 'local', 'name': 'Local Files', 'count': len(glob.glob('*.mp3'))}
    ]
    return jsonify(mock_playlists)

@socketio.on('control')
def handle_control(data):
    logging.info(f"Received control action: {data['action']}")
    emit('control', data, broadcast=True)

@socketio.on('join_room')
def handle_join_room(data):
    """Handle users joining a room for synchronized playback"""
    room = data.get('room', 'default')
    join_room(room)
    emit('status', {'message': f'Joined room {room}'}, room=room)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=8000, debug=True)
