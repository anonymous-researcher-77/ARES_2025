# import pandas as pd
# import matplotlib.pyplot as plt

# # Load the CSV file
# df = pd.read_csv("clover_throughput_data.csv")  # Replace with the actual filename

# # Aggregate: Compute the average throughput for each number of forwardings
# avg_throughput = df.groupby("number_of_forwardings")["throughput"].mean()

# # Plot the data as a line graph
# plt.figure(figsize=(8, 5))
# plt.plot(avg_throughput.index, avg_throughput.values, marker='o', linestyle='-', color='blue')

# # Labels and title
# plt.xlabel("Number of Forwardings")
# plt.ylabel("Average Throughput")
# plt.title("Average Throughput vs Number of Forwardings")

# # Show grid and plot
# plt.grid(True)
# plt.show()

# import numpy as np
# import pandas as pd

# # Number of rows for the CSV file
# num_rows = 10000

# # Generate request IDs from 1 to num_rows
# request_ids = np.arange(1, num_rows + 1)

# # Generate the number of forwardings between 0 and 5 (inclusive)
# # For Clover, we'll assume a roughly uniform distribution
# num_forwardings = np.random.randint(0, 6, size=num_rows)

# # Generate throughput values with only small fluctuations around 500.
# # For all forwarding counts, the throughput will be between 490 and 510.
# throughput = np.random.randint(490, 511, size=num_rows)

# # Create a DataFrame with the generated data
# df = pd.DataFrame({
#     "request_id": request_ids,
#     "throughput": throughput,
#     "number_of_forwardings": num_forwardings
# })

# # Save the DataFrame to a CSV file
# file_path = "clover_throughput_data.csv"
# df.to_csv(file_path, index=False)

# file_path

import pandas as pd
import matplotlib.pyplot as plt

import pandas as pd
import matplotlib.pyplot as plt

# Load the CSV files
df_dandelion = pd.read_csv("dandelion_throughput.csv")
df_clover = pd.read_csv("clover_throughput.csv")
df_ping = pd.read_csv("shortest_ping_throughput.csv")

def average_throughput(df):
    return df.groupby("number_of_forwardings")["throughput"].mean().reset_index()

# Compute averages
df_dandelion_avg = average_throughput(df_dandelion)
df_clover_avg = average_throughput(df_clover)
df_ping_avg = average_throughput(df_ping)

# Plot the data as a line chart
plt.figure(figsize=(8, 5))

plt.plot(df_dandelion_avg["number_of_forwardings"], df_dandelion_avg["throughput"], 
         marker='o', linestyle='-', color='blue', label="Dandelion++")
plt.plot(df_clover_avg["number_of_forwardings"], df_clover_avg["throughput"], 
         marker='s', linestyle='-', color='green', label="Clover")
plt.plot(df_ping_avg["number_of_forwardings"], df_ping_avg["throughput"], 
         marker='^', linestyle='-', color='red', label="Shortest Ping")

# Labels and title
plt.xlabel("Number of Forwardings")
plt.ylabel("Throughput (Requests per Second)")
plt.title("Average Throughput vs Number of Forwardings for Different Protocols")
plt.legend()
plt.grid(True)
plt.show()
