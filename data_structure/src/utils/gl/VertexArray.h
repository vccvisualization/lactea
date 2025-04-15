#pragma once

#include "Buffer.h"

struct VertexAttribute {
    size_t size;
    GLenum type;
    size_t offset;
};

class VertexArray {
private:
    GLuint id = 0;
    Buffer<GL_ARRAY_BUFFER> vbo;
    Buffer<GL_ELEMENT_ARRAY_BUFFER> ebo;
public:
    VertexArray(void *vbo_data, size_t vbo_element_count, size_t vbo_element_size, void *ebo_data, size_t ebo_element_count, size_t ebo_element_size, std::vector<VertexAttribute> attributes);
    ~VertexArray();

    void bind();
    void bindAll();
    void bindAll(unsigned int i, unsigned int j);
    void unbind();
    void draw(GLuint mode = GL_TRIANGLES, GLuint type = GL_UNSIGNED_BYTE);
    void drawArray(GLuint mode = GL_TRIANGLES);

    inline GLuint& getId() { return id; }
    inline Buffer<GL_ARRAY_BUFFER>& getVBO() { return vbo; }
    inline Buffer<GL_ELEMENT_ARRAY_BUFFER>& getEBO() { return ebo; }
};
