const net = require('net');
const stdin = process.openStdin();

let client = new net.Socket();
let PORT = 9999;

client.connect(PORT, '127.0.0.1', () => {
    console.log("Connected");
    stdin.addListener('data', (d) => {
	client.write(d.toString().trim());
    });
});

client.on('data', (data) => {
    console.log("Received: " + data);
});

client.on('close', () => {
    console.log("Disconnected from server");
});
