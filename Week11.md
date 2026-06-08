# Week 11 - Passive Honeypot Addition to LogScout

## What I Did

Added a passive honeypot to the EC2 server as an extension of the LogScout anomaly detection work. Instead of returning 404 for requests to /.env, nginx was reconfigured to serve a convincing fake /.env file containing plausible but false credentials: fake AWS keys, a fake Stripe secret, a fake database password, and a link to a picture of BMO from Adventure Time wearing a bandit costume at the bottom.

Hits to the honeypot are logged to a dedicated file at /var/log/nginx/honeypot.log using a custom nginx log format. LogScout was extended with a new backend endpoint and a new Honeypot tab in the dashboard that surfaces every hit with timestamp, IP, and path. In the first 48 hours after deployment, the honeypot recorded 23 hits from 20 unique IPs.

All work committed and pushed to github.com/rogerspj/logscout.

## Why I Did It This Way

Proof of concept for intelligence gathering to see which IPs are looking for credentials. The goal was to keep it static to avoid ethical concerns associated a more aggressive version. The fake AWS key is Amazon's published example key, so there was no risk of it being mistaken for a real credential.

It also serves as another detector. Some credential harvesters are quiet enough to get past the burst detector and sensitive path detector. If an attacker hits only one or two paths and gets a 200 response, the honeypot will catch this and flag it to me.

## Connection to Learning Objectives

Unit 3 - The honeypot is a dedicated audit trail for a specific category of attack behavior. Separating it from the main nginx access log helps separate signal from noise and puts specific events in their own category.

Unit 1 - The honeypot serves as a control that takes a vulnerability (potential for .env files to be exposed) and converts it into an intelligence asset. It also accepts some residual risk. If an attacker realizes it is fake, they could use this info to map the server's defenses. The tradeoff is that it logs credential harvesting activity.

## What I Learned

The honeypot was hit by 23 unique credential harvesters in the first 48 hours. It reinforced how the internet is continuously scanning for exposed .env files on reachable IPs. 

One IP, 124.198.132.189 hit the honeypot five times over two days, always requesting /.env.example immediately before /.env. This is a more thorough scanner script than ones that only look for /.env. The honeypot helped detect this pattern in a way that the nginx access log alone wouldn't have made obvious to me.

This IP didn't appear in the Threats tab despite five hits. It always got 200 responses and didn't probe enough other sensitive paths to trip the pattern detector. Since the honeypot detector was the only one that caught it, this showed the value of having multiple independent detection methods.