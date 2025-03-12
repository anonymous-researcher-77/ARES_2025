#!/bin/bash

for port in {3000..3009}; do
  PORT=$port node server0.js &
done
