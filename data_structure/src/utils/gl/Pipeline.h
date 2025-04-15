#pragma once

#include "glIncludes.h"


class Pipeline {
private:
    GLuint id = 0;
public:
    Pipeline(std::vector<std::string> filenames, std::map<std::string, std::string> defines = {});
    virtual ~Pipeline();
    void compileShader(std::string name, std::map<std::string, std::string> defines = {});
    void bind();
    void unbind();
    GLint getUniformLoc(const char *name);
    void setUniformBlock(const char *name, int slot);
    void setUniform(const char *name, float x, float y, float z);
    void setUniform(const char *name, const glm::vec2 & v);
    void setUniform(const char *name, const glm::vec3 & v);
    void setUniform(const char *name, const glm::vec4 & v);
    void setUniform(const char *name, const glm::mat4 & m);
    void setUniform(const char *name, const glm::mat3 & m);
    void setUniform(const char *name, float val );
    void setUniform(const char *name, int val);
    void setUniform(const char *name, bool val);
    void setUniform(const char *name, GLuint val);
    void setUniform(const char *name, uint64_t val);

    inline GLuint& getId() { return id; }
};
