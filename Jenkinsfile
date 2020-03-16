pipeline {
  agent {
    node {
      label 'master'
      customWorkspace '/var/onote/api'
    }
  }

  stages {
    stage('Clone Sources') {
      steps {
        git 'https://github.com/EricRabil/opennote-api.git'
      }
    }
    stage('Information') {
      steps {
        sh 'node -v'
        sh 'npm -v'
      }
    }
    stage('Dependencies') {
      steps {
        sh 'npm install'
      }
    }
    stage('Build') {
      steps {
        sh 'npm run build'
      }
    }
    stage('Deploy') {
      steps {
        load "/usr/share/jenkins/jenkins.groovy"
        sh 'pm2 stop onote-api-dev || true'
        sh "GOOGLE_ID=${env.GOOGLE_ID} GOOGLE_SECRET=${env.GOOGLE_SECRET} GOOGLE_CALLBACK=${env.GOOGLE_CALLBACK} FRONTEND_URL=${env.FRONTEND_URL} STORAGE=${env.STORAGE} pm2 start js/index.js --name \"onote-api-dev\""
      }
    }
    stage('Artifacts') {
      steps {
        sh 'tar -czf result.tar.gz ./js'
        archiveArtifacts artifacts: 'result.tar.gz', fingerprint: true
      }
    }
  }
}