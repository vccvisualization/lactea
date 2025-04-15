#include "VertexArray.h"


VertexArray::VertexArray(void *vbo_data, size_t vbo_element_count, size_t vbo_element_size, void *ebo_data, size_t ebo_element_count, size_t ebo_element_size, std::vector<VertexAttribute> attributes) :
        vbo(vbo_data, vbo_element_count, vbo_element_size),
        ebo(ebo_data, ebo_element_count, ebo_element_size) {

    glGenVertexArrays(1, &id);
    this->bind();
    vbo.bind();
    for (size_t i = 0; i < attributes.size(); i++) {
        glEnableVertexAttribArray(i);
        glVertexAttribPointer(i, attributes[i].size, attributes[i].type, GL_FALSE, vbo.getElementSize(), (void *) attributes[i].offset);
    }
    ebo.bind();
    vbo.unbind();
    this->unbind();
}

VertexArray::~VertexArray() {
    if(id != 0) glDeleteVertexArrays(1, &id);
}

void VertexArray::bind() {
   glBindVertexArray(id);
}

void VertexArray::bindAll() {
    this->bind();
    vbo.bind();
    ebo.bind();
}

void VertexArray::bindAll(unsigned int i, unsigned int j) {
    this->bind();
    vbo.bind(i);
    ebo.bind(j);
}

void VertexArray::unbind() {
    glBindVertexArray(0);
}

void VertexArray::draw(GLuint mode, GLuint type) {
    this->bindAll();
    glDrawElements(mode, ebo.getElementCount(), type, (void *) 0);
    this->unbind();
}

void VertexArray::drawArray(GLuint mode) {
    this->bind();
    ebo.unbind();
    vbo.bind();
    glDrawArrays(mode, 0, vbo.getElementCount());
    this->unbind();
}
