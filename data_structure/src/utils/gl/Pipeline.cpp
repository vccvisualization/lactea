#include "Pipeline.h"
#include <iostream>
#include <fstream>


Pipeline::Pipeline(std::vector<std::string> filenames, std::map<std::string, std::string> defines) {
    this->id = glCreateProgram();
    for(std::string &s : filenames) {
        compileShader(s, defines);
    }
    glLinkProgram(this->id);
}

void Pipeline::compileShader(std::string name, std::map<std::string, std::string> defines) {
    int type =
            name.ends_with(".frag") ? GL_FRAGMENT_SHADER : (
                    name.ends_with(".vert") ? GL_VERTEX_SHADER : (
                            name.ends_with(".geom") ? GL_GEOMETRY_SHADER : (
                                    name.ends_with(".comp") ? GL_COMPUTE_SHADER : (
                                            name.ends_with(".tesc") ? GL_TESS_CONTROL_SHADER : (
                                                    name.ends_with(".tese") ? GL_TESS_EVALUATION_SHADER : -1)))));
    if (type < 0) {
        printf("Invalid shader file ending for \"%s\"\n", name.c_str());
        return;
    }
    std::ifstream rawInput("res/shaders/" + name);
    if (!rawInput) {
        printf("Couldn't locate the file \"%s\"\n", name.c_str());
        return;
    }
    std::string contents((std::istreambuf_iterator<char>(rawInput)), std::istreambuf_iterator<char>());
    std::string finalCode = contents.substr(0, contents.find("\n") + 1);
    for (auto const &[key, val]: defines) {
        finalCode.append("#define " + key + + " " + val + "\n");
    }

    finalCode.append(contents.substr(contents.find("\n") + 1));

    const GLchar *source = finalCode.c_str();
    rawInput.close();

    GLuint shaderHandle = glCreateShader(type);
    glShaderSource(shaderHandle, 1, &source, NULL);
    glCompileShader(shaderHandle);

    GLint isCompiled = 0;
    glGetShaderiv(shaderHandle, GL_COMPILE_STATUS, &isCompiled);
    if (isCompiled == GL_FALSE) {
        GLint maxLength = 0;
        glGetShaderiv(shaderHandle, GL_INFO_LOG_LENGTH, &maxLength);

        // The maxLength includes the NULL character
        std::vector<GLchar> errorLog(maxLength);
        glGetShaderInfoLog(shaderHandle, maxLength, &maxLength, &errorLog[0]);

        glDeleteShader(shaderHandle); // Don't leak the shader.
        std::cout << errorLog.data();
        return;
    }
    glAttachShader(this->id, shaderHandle);
}

Pipeline::~Pipeline() {
    if(id == 0) return;

    GLint numShaders = 0;
    glGetProgramiv(id, GL_ATTACHED_SHADERS, &numShaders);
    GLuint * shaderNames = new GLuint[numShaders];
    glGetAttachedShaders(id, numShaders, NULL, shaderNames);
    for (int i = 0; i < numShaders; i++)
        glDeleteShader(shaderNames[i]);
    glDeleteProgram (id);
    delete[] shaderNames;
}

GLint Pipeline::getUniformLoc(const char *name) {
    return glGetUniformLocation(this->id, name);
    // return uniformIDs[name];
}

void Pipeline::setUniform(const char *name, float x, float y, float z) {
    GLint loc = getUniformLoc(name);
    glUniform3f(loc,x,y,z);
}

void Pipeline::setUniform(const char *name, const glm::vec3 & v) {
    this->setUniform(name,v.x,v.y,v.z);
}

void Pipeline::setUniform(const char *name, const glm::vec4 & v) {
    GLint loc = getUniformLoc(name);
    glUniform4f(loc,v.x,v.y,v.z,v.w);
}

void Pipeline::setUniform(const char *name, const glm::vec2 & v) {
    GLint loc = getUniformLoc(name);
    glUniform2f(loc,v.x,v.y);
}

void Pipeline::setUniform(const char *name, const glm::mat4 & m) {
    GLint loc = getUniformLoc(name);
    glUniformMatrix4fv(loc, 1, GL_FALSE, &m[0][0]);
}

void Pipeline::setUniform(const char *name, const glm::mat3 & m) {
    GLint loc = getUniformLoc(name);
    glUniformMatrix3fv(loc, 1, GL_FALSE, &m[0][0]);
}

void Pipeline::setUniform(const char *name, float val) {
    GLint loc = getUniformLoc(name);
    glUniform1f(loc, val);
}

void Pipeline::setUniform(const char *name, int val) {
    GLint loc = getUniformLoc(name);
    glUniform1i(loc, val);
}

void Pipeline::setUniform(const char *name, GLuint val) {
    GLint loc = getUniformLoc(name);
    glUniform1ui(loc, val);
}

void Pipeline::setUniform(const char *name, bool val) {
    int loc = getUniformLoc(name);
    glUniform1i(loc, val);
}

void Pipeline::setUniformBlock(const char *name, int slot) {
    glUniformBlockBinding(this->id, glGetUniformBlockIndex(this->id, name), slot);
}

void Pipeline::bind() {
    glUseProgram(id);
}

void Pipeline::unbind() {
    glUseProgram(0);
}

void Pipeline::setUniform(const char *name, uint64_t val) {
    int loc = getUniformLoc(name);
    glUniform1ui64NV(loc, val);
    glUniform1ui64ARB(loc, val);
}
