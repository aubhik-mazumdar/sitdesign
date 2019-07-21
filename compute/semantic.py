from collections import namedtuple
import operator
import os
import pickle
import spacy

Semant = namedtuple("Semant", "user design desc")

class SemanticDomain(object):
    def __init__(self, savefile):
        self.nlp = spacy.load('en_vectors_web_lg')
        self.desc = {}
        self.dmat = {}
        self.users = {}
        self.savefile = savefile

    def initialize(self):
        if os.path.exists(self.savefile):
            print('Loading cached information -- SEMANTIC-DOMAIN')
            with open(self.savefile, 'rb') as f:
                state = pickle.load(f)

            self.users = state['users']
            self.desc = state['desc']
            self.dmat = self.compute_matrix()
            print('Cached Distance Matrix: ')
            print(self.dmat)

    def add_desc(self, semant):
        self.desc[(semant.user, semant.design)] = self.nlp(semant.desc)

        if semant.user not in self.users:
            self.users[semant.user] = [semant.design]
        else:
            self.users[semant.user].append(semant.design)

        self.compute_matrix()

    def get_last_desc(self, user):
        if user in self.users:
            if self.users[user] == []:
                return None
            return (user, self.users[user][-1])
        return None

    def remove_desc(self, user, design_name):
        if (user, design_name) in self.desc:
            del self.desc[(user, design_name)]
        if self.users[user]:
            self.users[user].pop()

    def recommend(self, user, condition, n):
        last_design = self.get_last_design(user)
        if not last_design:
            return []
        dists = self.dmat[last_design]
        revr = condition == 'farthest'
        s = sorted(dists.items(), key=operator.itemgetter(1), reverse=revr)
        recomms = filter(lambda x: x[0][0] != user, s)
        return recomms[:n]

    def compute_matrix(self):
        M = {}
        for i in self.desc:
            for j in self.desc:
                if i not in M:
                    M[i] = {}
                if i == j:
                    continue
                M[i][j] = self._distance(i, j)
        self.dmat = M
        return M

    def _distance(self, i, j):
        return self.desc[i].similarity(self.desc[j])

    def serialize(self):
        state = {'users': self.users, 'desc': self.desc}
        with open(self.savefile, 'wb') as f:
            try:
                pickle.dump(state, f)
            except Exception as e:
                print("Serialization failed: ", str(e))
                return False
        return True
