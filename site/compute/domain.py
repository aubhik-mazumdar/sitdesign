import json
import numpy as np
import operator
import pickle
import os

from design import Design

class DesignDomain(object):
    def __init__(self, savefile):
        self.savefile = savefile
        self.initialize()
                    
    def initialize(self):
        if os.path.exists(self.savefile):

            print('Loading cached information -- DESIGN-DOMAIN')

            with open(self.savefile, 'rb') as f:
                state = pickle.load(f)
            self.users = state['users']
            self.designs = state['designs']
            self.dmat = self.compute_matrix()

            print('Cached Distance Matrix: ')
            print(self.dmat)
            
        else:
            self.users = {}
            self.designs = {} # full_name : <DesignProjection>
            self.dmat = None  # user_name : <UserInfo> <- for recommendations

    def add_design(self, des):
        # we only store the "projection" of the design onto this space
        self.designs[des.full_name] = des.project()

        if des.user not in self.users:
            self.users[des.user] = [des.name]
        else:
            self.users[des.user].append(des.name)
            
        self.dmat = self.compute_matrix()

    def get_last_design(self, user): # user_name -> full_name
        return (user, self.users[user][-1])

    def remove_design(self, user, design_name):
        # Need to test this function
        print('Function not fully implemented!!!!!!!!') #!!!!!!!!!!!!!!
        # Need to check if user and design_name actually exist
        del self.designs[(user, design_name)]
        if self.users[user]:
            self.users[user].pop()

    def recommend(self, user, condition, n):
        last_design = self.get_last_design(user)
        dists = self.dmat[last_design]
        revr = condition == 'farthest'
        s = sorted(dists.items(), key=operator.itemgetter(1), reverse=revr)
        return s[:n]
        
    def compute_matrix(self):
        M = {}
        for i in self.designs:
            for j in self.designs:
                if i not in M:
                    M[i] = {}
                if i == j:
                    continue
                M[i][j] = self._distance(i, j)
        return M

    def _distance(self, i, j):
        p1 = self.designs[i].values()
        p2 = self.designs[j].values()
        return np.sqrt(reduce(lambda a,x: (x[1]-x[0])**2 + a, zip(p1,p2), 0))

    def serialize(self):
        state = {'users': self.users, 'designs': self.designs}
        with open(self.savefile, 'wb') as f:
            pickle.dump(state, f)
        return
