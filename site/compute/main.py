import json
import ntpath
import pickle
import socket

from design import Design
from domain import DesignDomain

DOMAIN_FILE = './design-domain.pickle'
RECOMM_NUM = 3 # max number of designs to recommend

Dom = DesignDomain(DOMAIN_FILE)

def design_render_path(user, des):
    return '/' + user + '/' + des + '.stl'

render_path = lambda des: design_render_path(*des)

def handle_request(req):
    command = req['command']
    
    if command == u'NEW-USER':
        print('Handle')
        
    elif command == u'UPLOAD':
        des = Design(req['filePath'], req['userName'])
        print("Coordinates of the design: ")
        print(des.project())

        result = des.to_stl(req['fileDir'])
        result['properties'] = des.project()

        # compute distance matrix and other information
        Dom.add_design(des)
        print('Distance Matrix: ')
        print(Dom.dmat)

        return json.dumps(result)

    elif command == u'RECOMMEND':
        recomms = Dom.recommend(req['userName'], req['condition'], RECOMM_NUM)
        names = map(lambda x: x[0], recomms)
        paths = map(render_path, names)
        result = {'recommendations': paths}
        
        return json.dumps(result)

    elif command == u'DELETE':
        print('Received DELETE request')
        print('Request: ')
        print(request)

        Dom.remove_design(request['userName'], request['designName'])
        
        result = {'delete': 'SUCCESS'} # error handling required
        
        return json.dumps(result)

    else:
        print('Handle')

def cleanup():
    print('Cleaning stuff up!')
    Dom.serialize()

HOST, PORT = '127.0.0.1', 8080

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind((HOST, PORT))
s.listen(1)

print 'Listening on PORT ', PORT

while True:
    conn, addr = s.accept()
    print 'Client: ', addr
    data = conn.recv(1024)

    if data == 'CLOSE':
        break
    
    if not data:
        break

    request = json.loads(data)
    print 'SERVER: Received: ' + str(request)

    res = handle_request(request)
    conn.sendall(res)

conn.close()

cleanup()
