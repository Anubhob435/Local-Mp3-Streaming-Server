# 🎵 YouTube Music Streaming App

A beautiful, modern music streaming application that combines local MP3 files with YouTube search functionality. Built with Flask, Socket.IO, and the YouTube Data API.

## ✨ Features

- **🎯 YouTube Integration**: Search and discover music from YouTube
- **📁 Local File Support**: Stream MP3 files from your local directory
- **🎨 Modern UI**: Beautiful, responsive design with smooth animations
- **🔄 Real-time Sync**: Multiple users can control playback together via WebSocket
- **📱 Mobile Responsive**: Works great on desktop and mobile devices
- **🎛️ Full Player Controls**: Play, pause, seek, volume control, and more
- **📋 Playlists**: Organize your music (expandable feature)

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Get YouTube API Key

1. Go to the [Google Cloud Console](https://console.developers.google.com/)
2. Create a new project or select an existing one
3. Enable the YouTube Data API v3
4. Create credentials (API Key)
5. Copy your API key

### 3. Configure Environment

1. Open the `.env` file
2. Replace `your_youtube_api_key_here` with your actual YouTube API key:

```env
YOUTUBE_API_KEY=AIzaSyC-YourActualAPIKeyHere
```

### 4. Add Music Files

Place your MP3 files in the project directory alongside `app.py`. The app will automatically detect and list them.

### 5. Run the Application

```bash
python app.py
```

The app will be available at `http://localhost:8000`

## 🎯 Usage

### Local Files
- Navigate to "Local Files" in the sidebar
- Click on any MP3 file to start playing
- Use the player controls at the bottom

### YouTube Search
- Use the search bar at the top to find music on YouTube
- Click on search results to view details
- *Note: YouTube audio streaming requires additional setup (see Advanced Setup)*

### Multi-User Sync
- Multiple users can connect to the same server
- Playback controls are synchronized across all connected users
- Perfect for parties or shared listening sessions

## 🔧 Advanced Setup

### YouTube Audio Streaming

To enable actual YouTube audio playback, you'll need to implement one of these solutions:

1. **YouTube-DL Integration**: Use `yt-dlp` to extract audio streams
2. **YouTube Music API**: Use YouTube Music's official API (requires subscription)
3. **Proxy Streaming**: Set up a streaming proxy for YouTube audio

Example with yt-dlp:

```bash
pip install yt-dlp
```

Then modify the app to extract audio URLs using yt-dlp.

### Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["python", "app.py"]
```

Build and run:

```bash
docker build -t music-streaming-app .
docker run -p 8000:8000 -v $(pwd)/music:/app music-streaming-app
```

## 🛠️ API Endpoints

### Local Files
- `GET /mp3-list` - Get list of local MP3 files
- `GET /stream/<filename>` - Stream audio file

### YouTube Integration
- `GET /youtube/search?q=<query>&max_results=<num>` - Search YouTube
- `GET /youtube/video/<video_id>` - Get video details

### Playlists
- `GET /playlists` - Get available playlists

## 🎨 Customization

### Styling
The app uses CSS custom properties for easy theming. Modify the CSS variables in `templates/index.html`:

```css
:root {
    --primary-color: #667eea;
    --secondary-color: #764ba2;
    --background-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

### Adding Features
- Extend the Flask routes in `app.py`
- Add new sections to the sidebar navigation
- Implement additional player controls

## 🔒 Security Considerations

- **API Key Security**: Never commit your YouTube API key to version control
- **File Access**: The app only serves files from the project directory
- **CORS**: Configure CORS settings for production deployment
- **Rate Limiting**: Implement rate limiting for YouTube API calls

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## 🐛 Troubleshooting

### Common Issues

1. **YouTube API Quota Exceeded**
   - Monitor your API usage in Google Cloud Console
   - Implement caching to reduce API calls

2. **Audio Not Playing**
   - Check browser console for CORS errors
   - Ensure MP3 files are in the correct directory
   - Verify file permissions

3. **WebSocket Connection Issues**
   - Check firewall settings
   - Ensure port 8000 is accessible
   - Try different browsers

### Debug Mode

Run with debug logging:

```bash
FLASK_DEBUG=1 python app.py
```

## 📞 Support

If you encounter any issues or have questions:

1. Check the troubleshooting section above
2. Search existing GitHub issues
3. Create a new issue with detailed information

---

**Enjoy your music streaming experience! 🎵**
