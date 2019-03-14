import socket

HOST = ''
PORT = 9999

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.bind((HOST, PORT))
s.listen(1)

conn, addr = s.accept()
print 'Connection: ', conn
print 'Client: ', addr

while True:
    data = conn.recv(1024)
    if not data:
        break
    print "Received: " + data
    if data == 'compute':
        d = '{"id": 2, "name": "abc"}'
        conn.sendall(d)
        continue
    conn.sendall(data)
conn.close()    
