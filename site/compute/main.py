import datetime
import json
import ntpath
import pickle
import socket
import errno

from design import Design
from domain import DesignDomain

LOG_FILE = '../system-log.log'
DOMAIN_FILE = './design-domain.pickle'
RECOMM_NUM = 3 # max number of designs to recommend

def log(*args):
    val = reduce(lambda a, x: a + ' ' + str(x), args, '')
    print val
    with open(LOG_FILE, 'a') as f:
        f.write(str(datetime.datetime.now()) + ' ' + val + '\n')
    return

log('---- STARTING UP ----', '\n')

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
        result['score'] = des.score()

        # compute distance matrix and other information
        Dom.add_design(des)
        print('Distance Matrix: ')
        print(Dom.dmat)

        log('UPLOAD', req['filePath'], 'by', req['userName'], '\n\tPROPERTIES', str(des.project()))

        return json.dumps(result)

    elif command == u'RECOMMEND':
        recomms = Dom.recommend(req['userName'], req['condition'], RECOMM_NUM)
        names = map(lambda x: x[0], recomms)
        paths = map(render_path, names)
        result = {'recommendations': paths}

        log('RECOMMEND', 'to', req['userName'], '\n\tDESIGNS', str(paths))

        return json.dumps(result)

    elif command == u'DELETE':
        print('Received DELETE request')
        print('Request: ')
        print(req)

        Dom.remove_design(req['userName'], req['designName'])
        
        result = {'delete': 'SUCCESS'} # error handling required

        log('DELETE', 'design', req['designName'], 'by', req['userName'])        
        
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

    try:
        data = conn.recv(1024)
    except socket.error as (code, msg):
        continue
        # if code != errno.EINTR:
        #     continue

    if data == 'CLOSE':
        break
    
    if not data:
        break

    request = json.loads(data)
    print 'SERVER: Received: ' + str(request)

    res = handle_request(request)
    conn.sendall(res)

conn.close()
log('---- CLEANING UP ----', '\n')
cleanup()
