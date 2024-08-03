from flask import Flask, render_template, Response, send_file
from flask_socketio import SocketIO, emit
import logging

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

# Configure logging
logging.basicConfig(level=logging.DEBUG)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/stream')
def stream():
    def generate():
        try:
            with open('Armadham.mp3', 'rb') as f:  # Ensure the file name is correct
                data = f.read(1024)
                while data:
                    yield data
                    data = f.read(1024)
        except Exception as e:
            logging.error(f"Error reading file: {e}")
            yield b''
    return Response(generate(), mimetype='audio/mpeg')

@socketio.on('control')
def handle_control(data):
    logging.info(f"Received control action: {data['action']}")
    emit('control', data, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=8000, allow_unsafe_werkzeug=True)
