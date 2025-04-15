
export class Draggable {
	constructor(elementName) {
        this.draggable = document.querySelector(elementName);
        this.isDragging = false;
        this.offsetX = 0;
        this.offsetY = 0;

        this.draggable.addEventListener('mousedown', (event) => {
            if(event.altKey == true) {
                this.isDragging = true;
        
                this.offsetX = event.clientX - this.draggable.offsetLeft;
                this.offsetY = event.clientY - this.draggable.offsetTop;
            
                this.draggable.style.cursor = 'grabbing';
            }
        });
        document.addEventListener('mousemove', (event) => {
            if (this.isDragging) {
                this.draggable.style.left = `${event.clientX - this.offsetX}px`;
                this.draggable.style.top = `${event.clientY - this.offsetY}px`;
            }    
        });

        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.draggable.style.cursor = 'grab';
            }
        });
    }
}