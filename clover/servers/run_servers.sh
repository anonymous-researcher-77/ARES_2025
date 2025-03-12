#!/bin/bash

# Loop from 0 to 9 and run each server file in the background.
for i in {0..9}; do
  echo "Starting server${i}.js..."
  node server${i}.js &
done

# Wait for all background processes to exit.
wait

echo "All servers terminated."
