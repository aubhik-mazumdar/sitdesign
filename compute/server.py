#import SocketServer
import socketserver
import datetime
import errno
import json
import ntpath
import pickle

from design import Design
from domain import DesignDomain
from semantic import Semant, SemanticDomain

# Constants
VERBOSE = True
PRINT_MAT = False
LOG_FILE = './system-log.log'
DES_DOMAIN_FILE = './design-domain.pickle'
SEM_DOMAIN_FILE = './semantic-domain.pickle'
RECOMM_NUM = 3

def design_render_path(user, des):
	return '/' + user + '/' + des + '.stl'

render_path = lambda des: design_render_path(*des)

def log(*args):
    val = reduce(lambda a, x: a + ' ' + str(x), args, '')
    print(val)
    with open(LOG_FILE, 'a+') as f:
        f.write(str(datetime.datetime.now()) + ' ' + val + '\n')


# global `domain' objects
DesDom = DesignDomain(DES_DOMAIN_FILE)
SemDom = SemanticDomain(SEM_DOMAIN_FILE)

class SitDesignTCPHandler(SocketServer.BaseRequestHandler):
	def handle(self):
		self.data = json.loads(self.request.recv(1024).strip())
		command = self.data['command']
		
		if VERBOSE:
			print("{} asked: {}".format(self.client_address[0], command))

		if command == u'NEW-USER':
			if VERBOSE:
				print("NEW-USER command not implemented")
			
		elif command == u'UPLOAD':
			des = Design(self.data['filePath'],
						 self.data['userName'])
			des_name = des.full_name
			desc = Semant(self.data['userName'],
						  self.data['fileName'],
						  self.data['userDesc'])

			if VERBOSE:
				print("Design projection: {}".format(des.project()))

			result = des.to_stl(self.data['fileDir'])
			result['properties'] = des.project()
			result['score'] = des.score()

			# Compute matrices
			DesDom.add_design(des)
			SemDom.add_desc(desc)

			if VERBOSE and PRINT_MAT:
				print('Shape Matrix:')
				print(DesDom.dmat)
				print('Semantic Matrix:')
				print(SemDom.dmat)

			log('UPLOAD', self.data['filePath'], 'by', self.data['userName'],
				'\n\tPROPERTIES', str(des.project()))

			self.request.sendall(json.dumps(result))
			
		elif command == u'RECOMMEND':
			recomms = DesDom.recommend(self.data['userName'],
									   self.data['condition'],
									   RECOMM_NUM)
			names = map(lambda x: x[0], recomms)
			paths = map(render_path, names)
			result = {'recommendations': paths}

			if VERBOSE:
				print("Recommending {} to {}".format(result,
                                                         self.data['userName']))

			log('RECOMMEND', 'to', self.data['userName'],
				'\n\tDESIGNS', str(paths))

			self.request.sendall(json.dumps(result))

		elif command == u'DELETE':
			try:
				DesDom.remove_design(self.data['userName'],
									 self.data['designName'])
				SemDom.remove_desc(self.data['userName'],
								   self.data['fileName'])

				result = {'delete' : 'SUCCESS'}
				log('DELETE', 'design', self.data['designName'], 'by',
					self.data['userName'])

				self.request.sendall(json.dumps(result))

			except Exception as e:
				print(e)
		else:
			print("{} NOT_IMPLEMENTED".format(command))

	def finish(self):
		if VERBOSE:
			print("Serializing design domain distance matrix")
		try:
			DesDom.serialize()
		except Exception as e:
			print(e)

		# TODO : Handle SemDom matrix

if __name__ == "__main__":
	HOST, PORT = "0.0.0.0", 8080
	server = SocketServer.TCPServer((HOST, PORT), SitDesignTCPHandler)
	server.serve_forever()
