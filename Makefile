UUID := aw-gnome@ryzokuken.dev
EXT_DIR := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
SCHEMA_DIR := schemas

.PHONY: all schemas install uninstall pack test test-integration clean

all: schemas

schemas: $(SCHEMA_DIR)/gschemas.compiled

$(SCHEMA_DIR)/gschemas.compiled: $(SCHEMA_DIR)/*.xml
	glib-compile-schemas $(SCHEMA_DIR)

install: schemas
	mkdir -p $(EXT_DIR)
	cp -r extension.js metadata.json lib schemas icons $(EXT_DIR)/

uninstall:
	rm -rf $(EXT_DIR)

pack: schemas
	gnome-extensions pack --force \
	  --extra-source=lib \
	  --extra-source=icons \
	  --schema=schemas/org.gnome.shell.extensions.aw-gnome.gschema.xml

test:
	gjs -m tests/run.js

test-integration:
	gjs -m tests/integration/heartbeat.test.js

clean:
	rm -f $(SCHEMA_DIR)/gschemas.compiled
	rm -f *.shell-extension.zip
