import pandas as pd
import matplotlib.pyplot as plt

# Load CSV file
df = pd.read_csv("request_logs.csv")  # Replace with your actual file path

# Group by 'Number of Forwardings' and calculate the mean of 'Total Forwarding Time (ms)'
avg_forwarding_time = df.groupby("Number of Forwardings")["Total Forwarding Time (ms)"].mean()

# Plot
plt.figure(figsize=(8, 5))
plt.plot(avg_forwarding_time.index, avg_forwarding_time.values, marker='o', linestyle='-')

# Labels and title
plt.xlabel("Number of Forwardings")
plt.ylabel("Average Total Forwarding Time (ms)")
plt.title("Average Total Forwarding Time vs. Number of Forwardings")
plt.grid(True)

# Show plot
plt.show()
