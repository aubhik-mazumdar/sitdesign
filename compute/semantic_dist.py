import os
import operator
import spacy

base_dir = '/home/rmn/sit/res/programs/scripts/desc'
 
class SemanticDomain(object):
    def __init__(self, base_dir):
        self.base_dir = base_dir
        # self.nlp = spacy.load('en_core_web_lg')
        self.nlp = spacy.load('en_vectors_web_lg')
        self.desc = self._read_all_descriptions()
        self.dmat = None

    def matrix(self):
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

    def _adjs(self, obj):
        obj = self.desc[obj]
        
    def nearest(self, obj, n=5):
        if not self.dmat:
            self.matrix()
        dists = self.dmat[obj]
        s = sorted(dists.items(), key=operator.itemgetter(1), reverse=True)
        return s[:n]

    def farthest(self, obj, n=5):
        if not self.dmat:
            self.matrix()
        dists = self.dmat[obj]
        s = sorted(dists.items(), key=operator.itemgetter(1))
        return s[:n]

    def _read_all_descriptions(self):
        nlp_objs = {}
        for f in os.listdir(self.base_dir):
            fpath = os.path.join(self.base_dir, f)
            fname, fext = os.path.splitext(fpath)
            desc = self._read_description(fpath)
            nlp_objs[os.path.basename(fname)] = self.nlp(desc)
        return nlp_objs

    @staticmethod
    def _read_description(fpath):
        with open(fpath, 'r') as f:
            s = f.read().strip()
        return unicode(s, "utf-8")

    def __getitem__(self, item):
        return self.desc[item]

S = SemanticDomain(base_dir)
