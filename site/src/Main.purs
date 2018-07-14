module Main where

import Prelude hiding (gcd)
import Effect (Effect)
import Effect.Console (log)
import Control.Monad.Eff.Random (random)
import Control.Monad.Eff.Console (logShow)

main :: Effect Unit
main = do
  n <- random
  logShow n

gcd :: Int -> Int -> Int
gcd n m | n == 0 = m
gcd n m | m == 0 = n
gcd n m | n > m  = gcd (n - m) m
gcd n m = gcd (m - n) n
