## This is for Dandelion++

# import pandas as pd
# import matplotlib.pyplot as plt

# # Load the CSV file (replace 'your_file.csv' with your actual file path)
# data = pd.read_csv('/home/saeed/Desktop/Project/evaluation_results/without_invokation_time/Dandelion++/request_logs.csv')

# # Group data by "Number of Forwardings" and calculate the average forwarding time
# average_forwarding_time = data.groupby("Number of Forwardings")["Total Forwarding Time (ms)"].mean()

# # Plotting
# plt.figure(figsize=(10, 6))
# plt.plot(average_forwarding_time.index, average_forwarding_time.values, marker='o', linestyle='-', color='b')
# plt.title('Dandelion++', fontsize=14)
# plt.xlabel('Number of Forwardings', fontsize=12)
# plt.ylabel('Average Total Forwarding Time (ms)', fontsize=12)
# plt.grid(True)
# plt.show()

## This is for Full Forwarding + Fastest Ping

# import pandas as pd
# import matplotlib.pyplot as plt

# # Load the CSV file (replace 'your_file.csv' with your actual file path)
# data = pd.read_csv('/home/saeed/Desktop/Project/evaluation_results/without_invokation_time/full_forwarding_fastest_ping/request_logs_100_1.csv')

# # Group data by "Forwardings" and calculate the average time taken
# average_time_taken = data.groupby("Forwardings")["TimeTaken"].mean()

# # Plotting
# plt.figure(figsize=(10, 6))
# plt.plot(average_time_taken.index, average_time_taken.values, marker='o', linestyle='-', color='g')
# plt.title('Trend Between Number of Forwardings and Time Taken', fontsize=14)
# plt.xlabel('Number of Forwardings', fontsize=12)
# plt.ylabel('Average Time Taken (ms)', fontsize=12)
# plt.grid(True)
# plt.show()

## This is for Clover

# import pandas as pd
# import matplotlib.pyplot as plt

# # Load the CSV file (replace 'your_file.csv' with your actual file path)
# data = pd.read_csv('/home/saeed/Desktop/Project/evaluation_results/without_invokation_time/Clover/request_logs.csv')

# # Group data by "Number of Forwardings" and calculate the average forwarding time
# average_forwarding_time = data.groupby("Number of Forwardings")["Total Forwarding Time (ms)"].mean()

# # Plotting
# plt.figure(figsize=(10, 6))
# plt.plot(average_forwarding_time.index, average_forwarding_time.values, marker='o', linestyle='-', color='b')
# plt.title('Clover', fontsize=14)
# plt.xlabel('Number of Forwardings', fontsize=12)
# plt.ylabel('Average Total Forwarding Time (ms)', fontsize=12)
# plt.grid(True)
# plt.show()

## this is for Random Forwarding + Fastest Ping
# import pandas as pd
# import matplotlib.pyplot as plt

# # Load the CSV data (replace with actual file path)
# data = pd.read_csv('/home/saeed/Desktop/Project/substrate-contracts-node/fastest_ping/servers/forwarding_times.csv')

# # Group data by "number_of_forwardings" and calculate the average forwarding time
# average_forwarding_time = data.groupby("number_of_forwardings")["forwarding_time"].mean()

# # Plotting
# plt.figure(figsize=(10, 6))
# plt.plot(average_forwarding_time.index, average_forwarding_time.values, marker='o', linestyle='-', color='b')

# # Add title and labels
# plt.title('Shortest Ping + Random Forwarding', fontsize=14)
# plt.xlabel('Number of Forwardings', fontsize=12)
# plt.ylabel('Average Forwarding Time (ms)', fontsize=12)

# # Display grid and show plot
# plt.grid(True)
# plt.show()

## This is the integrated plot:

# import pandas as pd
# import matplotlib.pyplot as plt

# # Load the CSV files
# data_clover = pd.read_csv('/home/saeed/Desktop/Project/evaluation_results/without_invokation_time/Clover/request_logs.csv')
# data_dandelion = pd.read_csv('/home/saeed/Desktop/Project/evaluation_results/without_invokation_time/Dandelion++/request_logs.csv')

# # Group data by "Number of Forwardings" and calculate the average forwarding time for each dataset
# average_forwarding_time_clover = data_clover.groupby("Number of Forwardings")["Total Forwarding Time (ms)"].mean()
# average_forwarding_time_dandelion = data_dandelion.groupby("Number of Forwardings")["Total Forwarding Time (ms)"].mean()

# # Plotting both datasets on the same plot for comparison
# plt.figure(figsize=(10, 6))

# # Plot Clover data
# plt.plot(average_forwarding_time_clover.index, average_forwarding_time_clover.values, marker='o', linestyle='-', color='b', label='Clover')

# # Plot Dandelion++ data
# plt.plot(average_forwarding_time_dandelion.index, average_forwarding_time_dandelion.values, marker='o', linestyle='-', color='g', label='Dandelion++')

# # Add title and labels
# plt.title('Comparison of Forwarding Time Between Clover and Dandelion++', fontsize=14)
# plt.xlabel('Number of Forwardings', fontsize=12)
# plt.ylabel('Average Total Forwarding Time (ms)', fontsize=12)

# # Add legend
# plt.legend()

# # Display grid and show plot
# plt.grid(True)
# plt.show()


# import pandas as pd
# import matplotlib.pyplot as plt

# # Load the datasets
# clover_data = pd.read_csv('/home/saeed/Desktop/Project/evaluation_results/without_invokation_time/Clover/request_logs.csv')
# dandelion_data = pd.read_csv('/home/saeed/Desktop/Project/evaluation_results/without_invokation_time/Dandelion++/request_logs.csv')
# shortest_ping_data = pd.read_csv('/home/saeed/Desktop/Project/evaluation_results/without_invokation_time/full_forwarding_fastest_ping/request_logs(random_number_of_forwardings).csv')

# # Group data by "Number of Forwardings" or "number_of_forwardings" and calculate the average forwarding time
# clover_avg = clover_data.groupby("Number of Forwardings")["Total Forwarding Time (ms)"].mean()
# dandelion_avg = dandelion_data.groupby("Number of Forwardings")["Total Forwarding Time (ms)"].mean()
# shortest_ping_avg = shortest_ping_data.groupby("number_of_forwardings")["forwarding_time"].mean()

# # Plotting
# plt.figure(figsize=(10, 6))

# # Clover
# plt.plot(clover_avg.index, clover_avg.values, marker='o', linestyle='-', color='b', label='Clover')

# # Dandelion++
# plt.plot(dandelion_avg.index, dandelion_avg.values, marker='o', linestyle='-', color='g', label='Dandelion++')

# # Shortest Ping + Random Forwarding
# plt.plot(shortest_ping_avg.index, shortest_ping_avg.values, marker='o', linestyle='-', color='r', label='Shortest Ping + Random Forwarding')

# # Add title, labels, legend, and grid
# plt.title('Comparison of Forwarding Times', fontsize=14)
# plt.xlabel('Number of Forwardings', fontsize=12)
# plt.ylabel('Average Forwarding Time (ms)', fontsize=12)
# plt.legend()
# plt.grid(True)

# # Display the plot
# plt.show()


import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy.interpolate import make_interp_spline

# Load the CSV files
df_dandelion = pd.read_csv("dandelion_reliability_data.csv")
df_shortest_ping = pd.read_csv("shortest_ping_reliability_data.csv")
df_clover = pd.read_csv("clover_reliability_data.csv")

# Function to handle duplicate x values
def preprocess_data(df):
    df_grouped = df.groupby("node_failures")["processing_time"].mean().reset_index()  # Average out duplicates
    return df_grouped["node_failures"].values, df_grouped["processing_time"].values

# Function to create smooth curves
def smooth_curve(x, y):
    if len(x) < 4:  # Need at least 4 unique points for cubic splines
        return x, y
    x_smooth = np.linspace(min(x), max(x), 300)  # Generate smooth x values
    spline = make_interp_spline(x, y, k=3)  # Cubic spline interpolation
    y_smooth = spline(x_smooth)
    return x_smooth, y_smooth

# Preprocess data
x_dandelion, y_dandelion = preprocess_data(df_dandelion)
x_shortest_ping, y_shortest_ping = preprocess_data(df_shortest_ping)
x_clover, y_clover = preprocess_data(df_clover)

# Get smooth curves
x_dandelion_smooth, y_dandelion_smooth = smooth_curve(x_dandelion, y_dandelion)
x_shortest_ping_smooth, y_shortest_ping_smooth = smooth_curve(x_shortest_ping, y_shortest_ping)
x_clover_smooth, y_clover_smooth = smooth_curve(x_clover, y_clover)

# Plot the smoothed curves
plt.figure(figsize=(8, 5))
plt.plot(x_dandelion_smooth, y_dandelion_smooth, label="Dandelion++", color='red', linewidth=2)
plt.plot(x_shortest_ping_smooth, y_shortest_ping_smooth, label="Shortest Ping", color='blue', linewidth=2)
plt.plot(x_clover_smooth, y_clover_smooth, label="Clover", color='green', linewidth=2)

# Labels and title
plt.xlabel("Number of Failed Nodes")
plt.ylabel("Processing Time (ms)")
plt.title("Impact of Node Failures on Processing Time (Smoothed)")

# Show legend
plt.legend()

# Show grid
plt.grid(True, linestyle='--', alpha=0.6)

# Show plot
plt.show()
