.PHONY: pull up status destroy restore demo down help

# One-command surface for the whole multi-region demo.
#   make pull        # pre-pull every image (prep, so up works offline)
#   make up          # pre-flight, build, start 5 regions + monitoring + app
#   make status      # table of regions, health, ports, last writes
#   make destroy N   # stop region N
#   make restore N   # rebuild region N, live recovery
#   make demo        # scripted full run with live terminal panel
#   make down        # tear it all down (volumes included)

N ?= 1

pull:
	./world pull

up:
	./world up

status:
	./world status

destroy:
	./world region-destroy $(N)

restore:
	./world region-restore $(N)

demo:
	./world demo

down:
	./world down

help:
	./world help
