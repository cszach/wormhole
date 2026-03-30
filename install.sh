#!/bin/sh
set -e

DRY_RUN=0
START=0

for arg in "$@"; do
	case "$arg" in
		--dry-run|-n) DRY_RUN=1 ;;
		--start|-s) START=1 ;;
	esac
done

# Colors
BOLD='\033[1m'
DIM='\033[2m'
CYAN='\033[36m'
GREEN='\033[32m'
RED='\033[31m'
YELLOW='\033[33m'
RESET='\033[0m'

# Spinner frames
FRAMES='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'

spinner() {
	msg="$1"
	pid="$2"
	i=0
	while kill -0 "$pid" 2>/dev/null; do
		frame=$(echo "$FRAMES" | cut -c $((i % 10 + 1)))
		printf "\r  ${CYAN}%s${RESET}  %s" "$frame" "$msg"
		i=$((i + 1))
		sleep 0.08
	done
	wait "$pid" 2>/dev/null
	status=$?
	if [ $status -eq 0 ]; then
		printf "\r  ${GREEN}✓${RESET}  %s\n" "$msg"
	else
		printf "\r  ${RED}✗${RESET}  %s\n" "$msg"
		exit 1
	fi
}

clear

# Banner
printf "${CYAN}"
cat << 'BANNER'

    _      __               __        __
   | | /| / /__  ______ _  / /  ___  / /__
   | |/ |/ / _ \/ __/  ' \/ _ \/ _ \/ / -_)
   |__/|__/\___/_/ /_/_/_/_//_/\___/_/\__/

BANNER
printf "${RESET}"
printf "   ${DIM}Terminal telekinesis${RESET}\n\n"

# Check dependencies
missing=0

printf "  ${BOLD}Checking dependencies${RESET}\n\n"

if command -v node >/dev/null 2>&1; then
	node_v=$(node --version)
	printf "  ${GREEN}✓${RESET}  Node.js ${DIM}%s${RESET}\n" "$node_v"
else
	printf "  ${RED}✗${RESET}  Node.js ${DIM}not found — install from https://nodejs.org${RESET}\n"
	missing=1
fi

if command -v tmux >/dev/null 2>&1; then
	tmux_v=$(tmux -V)
	printf "  ${GREEN}✓${RESET}  tmux ${DIM}%s${RESET}\n" "$tmux_v"
else
	printf "  ${RED}✗${RESET}  tmux ${DIM}not found — install with your package manager${RESET}\n"
	missing=1
fi

if command -v git >/dev/null 2>&1; then
	printf "  ${GREEN}✓${RESET}  git\n"
else
	printf "  ${RED}✗${RESET}  git ${DIM}not found${RESET}\n"
	missing=1
fi

if [ $missing -ne 0 ]; then
	printf "\n  ${RED}Missing dependencies. Install them and try again.${RESET}\n\n"
	exit 1
fi

printf "\n  ${BOLD}Installing${RESET}\n\n"

if [ $DRY_RUN -eq 1 ]; then
	sleep 1.5 &
	spinner "Cloning repository" $!

	sleep 2 &
	spinner "Installing packages" $!
else
	git clone https://github.com/cszach/wormhole.git >/dev/null 2>&1 &
	spinner "Cloning repository" $!

	cd wormhole
	npm install --silent >/dev/null 2>&1 &
	spinner "Installing packages" $!
fi

# Start server in tmux
start_server() {
	session="wormhole"
	wormhole_dir="$(pwd)"

	# Handle session name collision
	if tmux has-session -t "$session" 2>/dev/null; then
		i=2
		while tmux has-session -t "${session}-${i}" 2>/dev/null; do
			i=$((i + 1))
		done
		session="${session}-${i}"
		printf "  ${YELLOW}!${RESET}  tmux session ${DIM}wormhole${RESET} already exists, using ${DIM}%s${RESET}\n" "$session"
	fi

	if [ $DRY_RUN -eq 1 ]; then
		printf "  ${GREEN}✓${RESET}  Started server in tmux session ${DIM}%s${RESET}\n" "$session"
	else
		tmux new-session -d -s "$session" -c "$wormhole_dir" "npm run dev"
		printf "  ${GREEN}✓${RESET}  Started server in tmux session ${DIM}%s${RESET}\n" "$session"
	fi

	printf "\n  ${GREEN}${BOLD}Done!${RESET} Server is running.\n\n"
	printf "  ${DIM}Open the address on your phone to get started.${RESET}\n"
	printf "  ${DIM}Attach to the session with:${RESET} ${CYAN}tmux attach -t %s${RESET}\n\n" "$session"
}

if [ $START -eq 1 ]; then
	printf "\n"
	start_server
else
	# Interactive prompt
	printf "\n  Start the server now? ${DIM}[Y/n]${RESET} "
	read -r answer
	case "$answer" in
		[Nn]*)
			printf "\n  ${GREEN}${BOLD}Done!${RESET} To get started:\n\n"
			printf "  ${CYAN}cd${RESET} wormhole\n"
			printf "  ${CYAN}npm run${RESET} dev\n\n"
			printf "  ${DIM}Then open the address on your phone.${RESET}\n\n"
			;;
		*)
			start_server
			;;
	esac
fi
