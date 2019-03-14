var net = require('net');
var stdin = process.openStdin();

var client = new net.Socket();
client.connect(9999, '127.0.0.1', () => {
    console.log('Connected');
    stdin.addListener('data', (d) => {
	client.write(d.toString().trim());
    });
});

client.on('data', (data) => {
    console.log('Received: ' + data);
    console.log(JSON.parse(data));
});

client.on('close', () =>  {
    console.log('Connection closed');
});
