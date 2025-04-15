import { toggleClass, projections } from "./utils/utils.js";

export class Camera {
	constructor() {

		this.offset = glMatrix.vec3.create();
		this.cursorPos = glMatrix.vec2.create();
		this.cursorPos2 = glMatrix.vec2.create();
		this.camLeft = glMatrix.vec3.create();
		this.camUp = glMatrix.vec3.create();
		this.camFwd = glMatrix.vec3.create();

		this.lastMouseCoords = glMatrix.vec2.create();
		this.selectionStart = false;
		this.zoomSpeed = 1.2;
		this.wheelEventEndTimeout = null;
		this.rot = glMatrix.mat4.create();
		this.vpMat = glMatrix.mat4.create();

		this.load({});
	}

	load(settings) {
		glMatrix.vec3.set(this.offset, settings?.offset?.[0] ?? 0.5, settings?.offset?.[1] ?? 0.5, 0);
		glMatrix.vec3.set(this.cursorPos, settings?.cursorPos?.[0] ?? 0, settings?.cursorPos?.[1] ?? 0);
		glMatrix.vec3.set(this.cursorPos2, settings?.cursorPos2?.[0] ?? 1, settings?.cursorPos2?.[1] ?? 1);
		glMatrix.vec3.set(this.camLeft, settings?.camLeft?.[0] ?? 1, settings?.camLeft?.[1] ?? 0, settings?.camLeft?.[2] ?? 0);
		glMatrix.vec3.set(this.camUp, settings?.camUp?.[0] ?? 0, settings?.camUp?.[1] ?? 1, settings?.camUp?.[2] ?? 0);
		glMatrix.vec3.set(this.camFwd, settings?.camFwd?.[0] ?? 0, settings?.camFwd?.[1] ?? 0, settings?.camFwd?.[2] ?? 1);

		this.proj = settings?.proj ?? projections.gal;
		this.areaSelector = settings?.areaSelector ?? true;
		this.fov = settings?.fov ?? (60.0 * Math.PI / 180.0);
		this.aspect = settings?.aspect ?? (16 / 9);
		this.nearClip = settings?.nearClip ?? 0.01;
		this.farClip = settings?.farClip ?? 100.0;
		this.zoom = settings?.zoom ?? 1;

		this.setCameraVec();
		this.updateMat();
	}

	store() {
		let settings = {};
		settings.proj = this.proj;
		settings.offset = [this.offset[0], this.offset[1]];
		settings.cursorPos = [this.cursorPos[0], this.cursorPos[1]];
		settings.cursorPos2 = [this.cursorPos2[0], this.cursorPos2[1]];
		settings.areaSelector = this.areaSelector;
		settings.camLeft = [this.camLeft[0], this.camLeft[1], this.camLeft[2]];
		settings.camUp = [this.camUp[0], this.camUp[1], this.camUp[2]];
		settings.camFwd = [this.camFwd[0], this.camFwd[1], this.camFwd[2]];
		settings.fov = this.fov;
		settings.aspect = this.aspect;
		settings.nearClip = this.nearClip;
		settings.farClip = this.farClip;
		settings.zoom = this.zoom;
		return settings;
	}

	moveCursor(xrel, yrel) {
		this.setOffset(this.offset[0] - xrel, this.offset[1] - yrel);
		// this.setRotation(this.rotation[0] - xrel, this.rotation[1] - yrel);
	}

	setOffset(x, y, z = this.offset[2]) {
		glMatrix.vec3.set(this.offset, x, y, z);
		// console.log(this.offset);
		this.setCameraVec();
		this.updateMat();
	}
	// setRotation(x, y) {
	// 	glMatrix.vec3.set(this.rotation, x, y, 0);
	// 	// console.log(this.offset);
	// 	this.setCameraVec();
	// 	this.updateMat();
	// }

	setCameraVec() {
		let rotX = (this.offset[0] * 2.0 - 1.0) * Math.PI;
		let rotY = (this.offset[1] + 0.5) * Math.PI;
		let rot = glMatrix.mat4.create();
		glMatrix.mat4.rotate(rot, rot, rotX, glMatrix.vec3.fromValues(0, 1, 0));
		glMatrix.mat4.rotate(rot, rot, rotY, glMatrix.vec3.fromValues(1, 0, 0));
		let rot3 = glMatrix.mat3.create();
		glMatrix.mat3.fromMat4(rot3, rot);
		glMatrix.vec3.transformMat3(this.camLeft, glMatrix.vec3.fromValues(1.0, 0.0, 0.0), rot3);
		glMatrix.vec3.transformMat3(this.camUp, glMatrix.vec3.fromValues(0.0, 1.0, 0.0), rot3);
		glMatrix.vec3.transformMat3(this.camFwd, glMatrix.vec3.fromValues(0.0, 0.0, 1.0), rot3);
	}

	updateCursorPos(xpos, ypos) {
		glMatrix.vec2.set(this.cursorPos, Math.max(Math.min(xpos, 1), 0), Math.max(Math.min(ypos, 1), 0));
	}
	updateCursorPos2(xpos, ypos) {
		glMatrix.vec2.set(this.cursorPos2, Math.max(Math.min(xpos, 1), 0), Math.max(Math.min(ypos, 1), 0));
	}

	updateZoom(scroll) {
		this.setZoom(this.zoom * Math.pow(this.zoomSpeed, 0.1 * scroll));
	}

	setZoom(scroll) {
		this.zoom = scroll;
		// console.log(this.zoom);
		this.fov = Math.min(360.0, 70.0 / this.zoom) / 360.0 * Math.PI;
		this.updateMat();
	}


	updateMat() {
		let look = glMatrix.mat4.create();
		glMatrix.mat4.lookAt(look, glMatrix.vec3.create(), this.camFwd, this.camUp);
		glMatrix.mat4.perspective(this.vpMat, this.fov, this.aspect, this.nearClip, this.farClip);
		glMatrix.mat4.mul(this.vpMat, this.vpMat, look);
	}

	manageMouse(canvas, settings, evt) {
		if(evt.altKey) { return; }
		const rect = canvas.getBoundingClientRect();
		const mouseCoords = glMatrix.vec2.fromValues(evt.clientX - rect.left, canvas.getBoundingClientRect().height + rect.top - evt.clientY - 1);
		if (evt.shiftKey) {
			if (evt.buttons == 1) { // selection drag
				this.areaSelector = true;
				this.updateCursorPos2(mouseCoords[0] / canvas.getBoundingClientRect().width, mouseCoords[1] / canvas.getBoundingClientRect().height);
				settings.updateUser();
				// settings.updateSpectrum();
			}
		}
		else {
			if (evt.buttons == 1) { // left click
				const dx = (mouseCoords[0] - this.lastMouseCoords[0]) / canvas.getBoundingClientRect().width;
				const dy = (mouseCoords[1] - this.lastMouseCoords[1]) / canvas.getBoundingClientRect().height;

				this.moveCursor(dx / this.zoom, dy / this.zoom);
				this.setCameraVec();
				this.updateMat();
				settings.reloadNoSpectrum();
				// settings.resetUpdateSpectrum();
				settings.mouseMoving = true;
			}
		}

		if (evt.buttons == 0) {
			if (this.selectionStart) {
				settings.updateUser();
				// settings.updateSpectrum();
				this.selectionStart = false;
			}
		}

		this.lastMouseCoords = mouseCoords;
	}

	selectSpectrum(canvas, settings, evt) {
		evt.preventDefault();
		if(evt.altKey) { return; }
		if (evt.buttons == 2 || (evt.buttons == 1 && evt.shiftKey)) {
			this.selectionStart = true;
			this.areaSelector = false;
			const rect = canvas.getBoundingClientRect();
			const mouseCoords = glMatrix.vec2.fromValues(evt.clientX - rect.left, canvas.getBoundingClientRect().height + rect.top - evt.clientY - 1);
			this.updateCursorPos(mouseCoords[0] / canvas.getBoundingClientRect().width, mouseCoords[1] / canvas.getBoundingClientRect().height);
			settings.updateUser();
			// settings.updateSpectrum();
		}
	}

	manageWheel(settings, evt) {
		evt.preventDefault();
		let zoom = evt.deltaY < 0 ? 2 : -2;
		this.updateZoom(zoom);
		settings.reloadEverything();
		settings.mouseMoving = true;
		clearTimeout(this.wheelEventEndTimeout);
		this.wheelEventEndTimeout = setTimeout(() => {
			settings.mouseMoving = false;
		}, 100);
	}

	manageKey(settings, evt) {
		if (
			!(evt.shiftKey || evt.ctrlKey)
			&&
			!(
				document.activeElement.tagName.toLowerCase() == "textarea" ||
				document.activeElement.tagName.toLowerCase() == "span"
			)
		) {
			if (evt.key == "Enter") {
				settings._pause = !settings._pause;
			}
			if (evt.key == " ") {
				evt.preventDefault();
				settings.profile = (settings.profile + 1) % settings.profiles.length;
				settings.loadProfile = true;
			}
			if (evt.key == "h") {
				toggleClass("#help", "hide");
			}
			if (evt.key == "g") {
				toggleClass(".lil-gui", "hide");
			}
			if (evt.key == "s") {
				toggleClass(".spectrum", "hide");
			}
			// if (evt.key == "f") {
			// 	toggleClass(".signature", "hide");
			// }
			if (evt.key == "p") {
				this.proj = (this.proj + 1) % Object.keys(projections).length;
				settings.reloadEverything();
			}
			if (evt.key == "m") {
				settings.showMinimap = !settings.showMinimap;
				settings.updateUser();
			}
			if (evt.key == "n") {
				settings.showNodeLayout = !settings.showNodeLayout;
				settings.updateUser();
			}
			// if (evt.key == "b") {
			// 	toggleClass(".progress", "hide");
			// }
			if (evt.key == "i") {
				toggleClass(".info", "hide");
			}
			if (evt.key == "c") {
				toggleClass(".colormap", "hide");
			}
			if (evt.key == "o") {
				// toggleClass("#maingui", "absolute");
				toggleClass("#info-container", "absolute");
				toggleClass("#figures", "absolute");
			}
		}
	}

	manageMouseUp(canvas, settings, evt) {
		evt.preventDefault();
		settings.updateSpectrum();
		settings.mouseMoving = false;
	}

	addEventListeners(canvas, settings) {
		canvas.addEventListener("mousedown", evt => this.selectSpectrum(canvas, settings, evt), false);
		canvas.addEventListener("mousemove", evt => this.manageMouse(canvas, settings, evt), false);
		canvas.addEventListener('mouseup', evt => this.manageMouseUp(canvas, settings, evt), false);

		canvas.addEventListener("wheel", evt => this.manageWheel(settings, evt), false);
		canvas.addEventListener("contextmenu", evt => this.selectSpectrum(canvas, settings, evt), false);
		document.addEventListener("keydown", evt => this.manageKey(settings, evt), false);
	}


	ui(gui, mainSettings) {
		const camera = gui.addFolder('Camera');

		camera.add(this, "proj", projections)
			.onChange(value => {
				mainSettings.reloadEverything();

			}).listen();
		camera.add(this.offset, "0")
			.name("viewX")
			.onChange(value => {
				this.setOffset(value, this.offset[1]);
				mainSettings.reloadEverything();
			})
			.listen();

		camera.add(this.offset, "1")
			.name("viewY")
			.onChange(value => {
				this.setOffset(this.offset[0], value);
				mainSettings.reloadEverything();
			})
			.listen();
		camera.add(this.offset, "2")
			.name("viewZ")
			.onChange(value => {
				this.setOffset(this.offset[0], this.offset[1], value);
				mainSettings.reloadEverything();
			})
			.listen();
		camera.add(this, "zoom")
			.onChange(value => {
				this.setZoom(value);
				mainSettings.reloadEverything();
			})
			.listen();

		camera.add(this.cursorPos, "0")
			.name("Selectionx")
			.onChange(value => {
				this.updateCursorPos(value, this.cursorPos[1]);
				mainSettings.updateSpectrum();
				mainSettings.updateUser();
			})
			.listen();

		camera.add(this.cursorPos, "1")
			.name("SelectionY")
			.onChange(value => {
				this.updateCursorPos(this.cursorPos[0], value);
				mainSettings.updateSpectrum();
				mainSettings.updateUser();
			})
			.listen();

		camera.add(this.cursorPos2, "0")
			.name("SelectionEndX")
			.onChange(value => {
				this.updateCursorPos2(value, this.cursorPos2[1]);
				mainSettings.updateSpectrum();
				mainSettings.updateUser();
			})
			.listen();

		camera.add(this.cursorPos2, "1")
			.name("SelectionEndY")
			.onChange(value => {
				this.updateCursorPos2(this.cursorPos2[0], value);
				mainSettings.updateSpectrum();
				mainSettings.updateUser();
			})
			.listen();
		camera.add(this, "areaSelector")
			.onChange(value => {
				mainSettings.updateSpectrum();
				mainSettings.updateUser();
			})
			.listen();
	}
}
